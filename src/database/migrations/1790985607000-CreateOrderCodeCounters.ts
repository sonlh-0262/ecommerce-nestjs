import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderCodeCounters1790985607000 implements MigrationInterface {
  name = 'CreateOrderCodeCounters1790985607000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_code_counters" (
        "order_date" date        NOT NULL,
        "last_seq"   integer     NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_code_counters_order_date" PRIMARY KEY ("order_date"),
        CONSTRAINT "CHK_order_code_counters_seq" CHECK (last_seq >= 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_code_counters"`);
  }
}
