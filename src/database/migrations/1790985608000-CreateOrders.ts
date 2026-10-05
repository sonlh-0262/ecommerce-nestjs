import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrders1790985608000 implements MigrationInterface {
  name = 'CreateOrders1790985608000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id"                      uuid             NOT NULL DEFAULT gen_random_uuid(),
        "code"                    varchar(20)      NOT NULL,
        "user_id"                 uuid             NOT NULL,
        "status"                  "order_status"   NOT NULL DEFAULT 'PENDING',
        "payment_method"          "payment_method" NOT NULL,
        "payment_status"          "payment_status" NOT NULL DEFAULT 'UNPAID',
        "payment_transaction_ref" varchar(100)     NULL,
        "paid_at"                 timestamptz      NULL,
        "receiver_name"           varchar(100)     NOT NULL,
        "receiver_phone"          varchar(20)      NOT NULL,
        "shipping_address"        varchar(255)     NOT NULL,
        "note"                    varchar(500)     NULL,
        "subtotal"                bigint           NOT NULL,
        "shipping_fee"            bigint           NOT NULL DEFAULT 0,
        "total"                   bigint           NOT NULL,
        "reason"                  varchar(500)     NULL,
        "delivered_at"            timestamptz      NULL,
        "created_at"              timestamptz      NOT NULL DEFAULT now(),
        "updated_at"              timestamptz      NOT NULL DEFAULT now(),
        CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_orders_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_orders_amounts"
          CHECK (subtotal >= 0 AND shipping_fee >= 0 AND total = subtotal + shipping_fee),
        CONSTRAINT "CHK_orders_reject_reason"
          CHECK (status <> 'REJECTED' OR (reason IS NOT NULL AND char_length(reason) >= 10)),
        CONSTRAINT "CHK_orders_delivered_at"
          CHECK ((status = 'DELIVERED') = (delivered_at IS NOT NULL)),
        CONSTRAINT "CHK_orders_paid_at"
          CHECK ((payment_status = 'PAID') = (paid_at IS NOT NULL)),
        CONSTRAINT "CHK_orders_transaction_ref"
          CHECK (payment_transaction_ref IS NULL OR payment_method = 'BANK_TRANSFER')
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_orders_code" ON "orders" ("code")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_user_created_at"
        ON "orders" ("user_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_status_created_at"
        ON "orders" ("status", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_delivered_at"
        ON "orders" ("delivered_at")
        WHERE "status" = 'DELIVERED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "orders"`);
  }
}
