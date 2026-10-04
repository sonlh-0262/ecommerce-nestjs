import { MigrationInterface, QueryRunner } from 'typeorm';

const SEARCH_VECTOR_EXPRESSION =
  "setweight(to_tsvector('simple', immutable_unaccent(coalesce(name, ''))), 'A') || " +
  "setweight(to_tsvector('simple', immutable_unaccent(coalesce(description, ''))), 'B')";

export class CreateProducts1790985604000 implements MigrationInterface {
  name = 'CreateProducts1790985604000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id"             uuid             NOT NULL DEFAULT gen_random_uuid(),
        "category_id"    uuid             NOT NULL,
        "name"           varchar(255)     NOT NULL,
        "slug"           varchar(280)     NOT NULL,
        "description"    text             NULL,
        "price"          bigint           NOT NULL,
        "sale_price"     bigint           NULL,
        "stock"          integer          NOT NULL DEFAULT 0,
        "status"         "product_status" NOT NULL DEFAULT 'DRAFT',
        "is_featured"    boolean          NOT NULL DEFAULT false,
        "sold_count"     integer          NOT NULL DEFAULT 0,
        "average_rating" numeric(3,2)     NOT NULL DEFAULT 0,
        "review_count"   integer          NOT NULL DEFAULT 0,
        "search_vector"  tsvector         GENERATED ALWAYS AS (${SEARCH_VECTOR_EXPRESSION}) STORED,
        "created_at"     timestamptz      NOT NULL DEFAULT now(),
        "updated_at"     timestamptz      NOT NULL DEFAULT now(),
        "deleted_at"     timestamptz      NULL,
        CONSTRAINT "PK_products_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_products_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_products_price"        CHECK (price >= 0),
        CONSTRAINT "CHK_products_sale_price"   CHECK (sale_price IS NULL
                                                 OR (sale_price >= 0 AND sale_price < price)),
        CONSTRAINT "CHK_products_stock"        CHECK (stock >= 0),
        CONSTRAINT "CHK_products_sold_count"   CHECK (sold_count >= 0),
        CONSTRAINT "CHK_products_rating"       CHECK (average_rating >= 0 AND average_rating <= 5),
        CONSTRAINT "CHK_products_review_count" CHECK (review_count >= 0),
        CONSTRAINT "CHK_products_archived"     CHECK (deleted_at IS NULL OR status = 'ARCHIVED')
      )
    `);

    // TypeORM reads a generated column expression from here, not from
    // information_schema. Without the row, every migration:generate would
    // report search_vector as drifted.
    await queryRunner.query(
      `
        INSERT INTO "typeorm_metadata"
          ("database", "schema", "table", "type", "name", "value")
        VALUES (current_database(), current_schema(), 'products',
                'GENERATED_COLUMN', 'search_vector', $1)
      `,
      [SEARCH_VECTOR_EXPRESSION],
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_products_slug" ON "products" ("slug")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_search_vector"
        ON "products" USING GIN ("search_vector")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_public_list"
        ON "products" ("category_id", "created_at" DESC, "id" DESC)
        WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_effective_price"
        ON "products" (COALESCE("sale_price", "price"))
        WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_sold_count"
        ON "products" ("sold_count" DESC, "id" DESC)
        WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_rating"
        ON "products" ("average_rating" DESC, "id" DESC)
        WHERE "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_featured"
        ON "products" ("created_at" DESC, "id" DESC)
        WHERE "is_featured" AND "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_admin_list"
        ON "products" ("status", "created_at" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(`
      DELETE FROM "typeorm_metadata"
        WHERE "type" = 'GENERATED_COLUMN'
          AND "database" = current_database()
          AND "schema" = current_schema()
          AND "table" = 'products'
          AND "name" = 'search_vector'
    `);
  }
}
