import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationTokenType1793836800000 implements MigrationInterface {
  name = 'AddInvitationTokenType1793836800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "user_token_type" ADD VALUE IF NOT EXISTS 'INVITATION'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "user_tokens" WHERE "type" = 'INVITATION'`,
    );
    await queryRunner.query(
      `ALTER TYPE "user_token_type" RENAME TO "user_token_type_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_token_type" AS ENUM ('EMAIL_VERIFY', 'RESET_PASSWORD')`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_tokens"
        ALTER COLUMN "type" TYPE "user_token_type"
        USING "type"::text::"user_token_type"
    `);
    await queryRunner.query(`DROP TYPE "user_token_type_old"`);
  }
}
