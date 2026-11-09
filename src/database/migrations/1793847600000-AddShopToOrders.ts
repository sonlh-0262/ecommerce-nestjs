import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShopToOrders1793847600000 implements MigrationInterface {
  name = 'AddShopToOrders1793847600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "shop_id" uuid NULL,
        ADD CONSTRAINT "FK_orders_shop" FOREIGN KEY ("shop_id")
          REFERENCES "shops" ("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_shop_created_at"
        ON "orders" ("shop_id", "created_at" DESC, "id" DESC)
        WHERE "shop_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_orders_shop_created_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "shop_id"`);
  }
}
