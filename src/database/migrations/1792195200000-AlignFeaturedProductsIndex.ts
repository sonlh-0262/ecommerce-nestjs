import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignFeaturedProductsIndex1792195200000 implements MigrationInterface {
  name = 'AlignFeaturedProductsIndex1792195200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_products_featured"`);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_featured"
        ON "products" ("sold_count" DESC, "id" DESC)
        WHERE "is_featured" AND "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_products_featured"`);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_featured"
        ON "products" ("created_at" DESC, "id" DESC)
        WHERE "is_featured" AND "status" = 'PUBLISHED' AND "deleted_at" IS NULL
    `);
  }
}
