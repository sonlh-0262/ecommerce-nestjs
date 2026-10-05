import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductImages1790985605000 implements MigrationInterface {
  name = 'CreateProductImages1790985605000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_images" (
        "id"            uuid        NOT NULL DEFAULT gen_random_uuid(),
        "product_id"    uuid        NOT NULL,
        "attachment_id" uuid        NOT NULL,
        "is_thumbnail"  boolean     NOT NULL DEFAULT false,
        "position"      smallint    NOT NULL DEFAULT 0,
        "created_at"    timestamptz NOT NULL DEFAULT now(),
        "updated_at"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_images_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_images_product" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_images_attachment" FOREIGN KEY ("attachment_id")
          REFERENCES "attachments" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_product_images_position" CHECK (position >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_images_attachment"
        ON "product_images" ("attachment_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_images_product_pos"
        ON "product_images" ("product_id", "position")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_product_images_thumbnail"
        ON "product_images" ("product_id")
        WHERE "is_thumbnail"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_images"`);
  }
}
