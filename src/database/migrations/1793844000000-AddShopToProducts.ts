import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShopToProducts1793844000000 implements MigrationInterface {
  name = 'AddShopToProducts1793844000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "products"
        ADD COLUMN "shop_id" uuid NULL,
        ADD CONSTRAINT "FK_products_shop" FOREIGN KEY ("shop_id")
          REFERENCES "shops" ("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_products_shop_created_at"
        ON "products" ("shop_id", "created_at" DESC, "id" DESC)
        WHERE "shop_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_products_shop_created_at"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "shop_id"`);
  }
}
