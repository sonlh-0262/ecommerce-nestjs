import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1793854800000 implements MigrationInterface {
  name = 'CreatePayments1793854800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "payment_provider" AS ENUM ('MOCK', 'STRIPE')`,
    );
    await queryRunner.query(`
      CREATE TYPE "payment_attempt_status" AS ENUM (
        'PENDING', 'REQUIRES_ACTION', 'SUCCEEDED', 'FAILED',
        'REFUND_PENDING', 'REFUNDED'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id"                  uuid                     NOT NULL,
        "order_id"            uuid                     NOT NULL,
        "provider"            "payment_provider"       NOT NULL,
        "provider_payment_id" varchar(255)             NOT NULL,
        "client_secret"       varchar(255)             NOT NULL,
        "status"              "payment_attempt_status" NOT NULL DEFAULT 'PENDING',
        "amount"              bigint                   NOT NULL,
        "currency"            char(3)                  NOT NULL,
        "card_brand"          varchar(20)              NULL,
        "card_last4"          char(4)                  NULL,
        "failure_code"        varchar(50)              NULL,
        "failure_message"     varchar(255)             NULL,
        "provider_refund_id"  varchar(255)             NULL,
        "succeeded_at"        timestamptz              NULL,
        "refunded_at"         timestamptz              NULL,
        "created_at"          timestamptz              NOT NULL DEFAULT now(),
        "updated_at"          timestamptz              NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_payments_amount" CHECK (amount > 0),
        CONSTRAINT "CHK_payments_succeeded_at"
          CHECK ((status IN ('SUCCEEDED', 'REFUND_PENDING', 'REFUNDED')) = (succeeded_at IS NOT NULL)),
        CONSTRAINT "CHK_payments_refunded_at"
          CHECK ((status = 'REFUNDED') = (refunded_at IS NOT NULL))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payments_provider_payment_id"
        ON "payments" ("provider", "provider_payment_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payments_open_per_order"
        ON "payments" ("order_id")
        WHERE status IN ('PENDING', 'REQUIRES_ACTION')
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payments_order_created_at"
        ON "payments" ("order_id", "created_at" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "payment_attempt_status"`);
    await queryRunner.query(`DROP TYPE "payment_provider"`);
  }
}
