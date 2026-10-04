import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCarts1790985606000 implements MigrationInterface {
  name = 'CreateCarts1790985606000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "carts" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    uuid        NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_carts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_carts_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_carts_user" ON "carts" ("user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "cart_items" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "cart_id"    uuid        NOT NULL,
        "product_id" uuid        NOT NULL,
        "quantity"   integer     NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cart_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_cart_items_cart" FOREIGN KEY ("cart_id")
          REFERENCES "carts" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cart_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_cart_items_quantity" CHECK (quantity > 0)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_cart_items_cart_product"
        ON "cart_items" ("cart_id", "product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cart_items"`);
    await queryRunner.query(`DROP TABLE "carts"`);
  }
}
