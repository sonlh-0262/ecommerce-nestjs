import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardPayments1793851200000 implements MigrationInterface {
  name = 'AddCardPayments1793851200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "payment_method" ADD VALUE IF NOT EXISTS 'CARD'`,
    );
    await queryRunner.query(
      `ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'REFUNDED'`,
    );
    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT "CHK_orders_paid_at",
        ADD CONSTRAINT "CHK_orders_paid_at"
          CHECK ((payment_status = 'UNPAID') = (paid_at IS NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(`
      SELECT count(*)::int AS "count" FROM "orders"
      WHERE "payment_method" = 'CARD' OR "payment_status" = 'REFUNDED'
    `)) as { count: number }[];

    if (count > 0) {
      throw new Error(
        `Cannot revert ${this.name}: ${count} orders are paid by card or refunded`,
      );
    }

    await queryRunner.query(`
      ALTER TABLE "orders"
        DROP CONSTRAINT "CHK_orders_paid_at",
        DROP CONSTRAINT "CHK_orders_transaction_ref"
    `);
    await queryRunner.query(
      `ALTER TYPE "payment_status" RENAME TO "payment_status_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_status" AS ENUM ('UNPAID', 'PAID')`,
    );
    await queryRunner.query(
      `ALTER TYPE "payment_method" RENAME TO "payment_method_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_method" AS ENUM ('COD', 'BANK_TRANSFER')`,
    );
    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "payment_status" DROP DEFAULT,
        ALTER COLUMN "payment_status" TYPE "payment_status"
          USING "payment_status"::text::"payment_status",
        ALTER COLUMN "payment_status" SET DEFAULT 'UNPAID',
        ALTER COLUMN "payment_method" TYPE "payment_method"
          USING "payment_method"::text::"payment_method"
    `);
    await queryRunner.query(`DROP TYPE "payment_status_old"`);
    await queryRunner.query(`DROP TYPE "payment_method_old"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD CONSTRAINT "CHK_orders_paid_at"
          CHECK ((payment_status = 'PAID') = (paid_at IS NOT NULL)),
        ADD CONSTRAINT "CHK_orders_transaction_ref"
          CHECK (payment_transaction_ref IS NULL OR payment_method = 'BANK_TRANSFER')
    `);
  }
}
