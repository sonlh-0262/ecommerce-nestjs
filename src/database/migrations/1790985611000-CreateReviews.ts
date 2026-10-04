import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReviews1790985611000 implements MigrationInterface {
  name = 'CreateReviews1790985611000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id"         uuid          NOT NULL DEFAULT gen_random_uuid(),
        "product_id" uuid          NOT NULL,
        "user_id"    uuid          NOT NULL,
        "order_id"   uuid          NULL,
        "rating"     smallint      NOT NULL,
        "content"    varchar(1000) NOT NULL,
        "created_at" timestamptz   NOT NULL DEFAULT now(),
        "updated_at" timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reviews_product" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_reviews_rating"  CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT "CHK_reviews_content" CHECK (char_length(content) BETWEEN 10 AND 1000)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reviews_product_user"
        ON "reviews" ("product_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reviews_product_created_at"
        ON "reviews" ("product_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reviews_product_rating"
        ON "reviews" ("product_id", "rating")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reviews"`);
  }
}
