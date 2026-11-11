import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentEvents1793858400000 implements MigrationInterface {
  name = 'CreatePaymentEvents1793858400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payment_events" (
        "id"                uuid               NOT NULL DEFAULT gen_random_uuid(),
        "provider"          "payment_provider" NOT NULL,
        "provider_event_id" varchar(255)       NOT NULL,
        "type"              varchar(100)       NOT NULL,
        "payment_id"        uuid               NULL,
        "payload"           jsonb              NOT NULL,
        "received_at"       timestamptz        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_events_payment" FOREIGN KEY ("payment_id")
          REFERENCES "payments" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_payment_events_provider_event_id"
        ON "payment_events" ("provider", "provider_event_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_events_payment_id"
        ON "payment_events" ("payment_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payment_events"`);
  }
}
