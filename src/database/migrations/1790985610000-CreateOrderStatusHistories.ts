import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrderStatusHistories1790985610000 implements MigrationInterface {
  name = 'CreateOrderStatusHistories1790985610000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_status_histories" (
        "id"          uuid           NOT NULL DEFAULT gen_random_uuid(),
        "order_id"    uuid           NOT NULL,
        "from_status" "order_status" NULL,
        "to_status"   "order_status" NOT NULL,
        "reason"      varchar(500)   NULL,
        "changed_by"  uuid           NULL,
        "created_at"  timestamptz    NOT NULL DEFAULT now(),
        "updated_at"  timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_status_histories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_order_status_histories_order" FOREIGN KEY ("order_id")
          REFERENCES "orders" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_status_histories_user" FOREIGN KEY ("changed_by")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_order_status_histories_transition"
          CHECK (from_status IS NULL OR from_status <> to_status)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_order_status_histories_order_created_at"
        ON "order_status_histories" ("order_id", "created_at", "id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_status_histories"`);
  }
}
