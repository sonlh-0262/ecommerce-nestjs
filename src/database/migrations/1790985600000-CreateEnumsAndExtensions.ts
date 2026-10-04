import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnumsAndExtensions1790985600000 implements MigrationInterface {
  name = 'CreateEnumsAndExtensions1790985600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "unaccent"`);

    // unaccent() is STABLE up to PostgreSQL 16, and a generated column only
    // accepts an IMMUTABLE expression. Pinning the dictionary by name makes
    // the wrapper true to its label; REINDEX if unaccent.rules ever changes.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "immutable_unaccent"(text) RETURNS text
        LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
        $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
    `);

    await queryRunner.query(
      `CREATE TYPE "user_token_type" AS ENUM ('EMAIL_VERIFY', 'RESET_PASSWORD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "attachable_type" AS ENUM ('User', 'Product')`,
    );
    await queryRunner.query(
      `CREATE TYPE "product_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED')`,
    );
    await queryRunner.query(`
      CREATE TYPE "order_status" AS ENUM
        ('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'REJECTED')
    `);
    await queryRunner.query(
      `CREATE TYPE "payment_method" AS ENUM ('COD', 'BANK_TRANSFER')`,
    );
    await queryRunner.query(
      `CREATE TYPE "payment_status" AS ENUM ('UNPAID', 'PAID')`,
    );
    await queryRunner.query(
      `CREATE TYPE "suggestion_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE "suggestion_status"`);
    await queryRunner.query(`DROP TYPE "payment_status"`);
    await queryRunner.query(`DROP TYPE "payment_method"`);
    await queryRunner.query(`DROP TYPE "order_status"`);
    await queryRunner.query(`DROP TYPE "product_status"`);
    await queryRunner.query(`DROP TYPE "attachable_type"`);
    await queryRunner.query(`DROP TYPE "user_token_type"`);
    await queryRunner.query(`DROP FUNCTION "immutable_unaccent"(text)`);
  }
}
