import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderItems1790985609000 implements MigrationInterface {
  name = 'CreateOrderItems1790985609000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id"           uuid         NOT NULL DEFAULT gen_random_uuid(),
        "order_id"     uuid         NOT NULL,
        "product_id"   uuid         NOT NULL,
        "product_name" varchar(255) NOT NULL,
        "product_slug" varchar(280) NOT NULL,
        "unit_price"   bigint       NOT NULL,
        "quantity"     integer      NOT NULL,
        "line_total"   bigint       NOT NULL,
        "created_at"   timestamptz  NOT NULL DEFAULT now(),
        "updated_at"   timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_order_items_quantity"   CHECK (quantity > 0),
        CONSTRAINT "CHK_order_items_unit_price" CHECK (unit_price >= 0),
        CONSTRAINT "CHK_order_items_line_total" CHECK (line_total = unit_price * quantity)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_order_items_order_product"
        ON "order_items" ("order_id", "product_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_order_items_product_id"
        ON "order_items" ("product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
  }
}
