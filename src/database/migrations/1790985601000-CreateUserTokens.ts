import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTokens1790985601000 implements MigrationInterface {
  name = 'CreateUserTokens1790985601000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_tokens" (
        "id"         uuid              NOT NULL DEFAULT gen_random_uuid(),
        "user_id"    uuid              NOT NULL,
        "type"       "user_token_type" NOT NULL,
        "token_hash" char(64)          NOT NULL,
        "expires_at" timestamptz       NOT NULL,
        "used_at"    timestamptz       NULL,
        "created_at" timestamptz       NOT NULL DEFAULT now(),
        "updated_at" timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_tokens_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_user_tokens_expiry" CHECK (expires_at > created_at)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_tokens_token_hash"
        ON "user_tokens" ("token_hash")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_user_tokens_user_type"
        ON "user_tokens" ("user_id", "type")
        WHERE "used_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_tokens"`);
  }
}
