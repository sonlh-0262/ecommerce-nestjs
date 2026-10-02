import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The accounts table, plus the two enum types it depends on.
 *
 * Hand-written rather than generated, because three of its objects are shapes
 * the entity decorators cannot describe and `migration:generate` would
 * therefore get wrong:
 *
 * - `UQ_users_email` indexes `lower(email)`, so `A@x.com` and `a@x.com` cannot
 *   both be registered - and every lookup by email has to compare the same
 *   expression or it will not use the index.
 * - both unique indexes are partial (`WHERE deleted_at IS NULL`), so the email
 *   of a soft-deleted account does not block that address forever.
 * - `IDX_users_status_created_at` matches how the admin user list filters and
 *   pages, including the `id` tie-breaker that keeps paging stable.
 */
export class CreateUsersTable1790899200000 implements MigrationInterface {
  name = 'CreateUsersTable1790899200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN')`,
    );
    await queryRunner.query(
      `CREATE TYPE "user_status" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"                  uuid          NOT NULL DEFAULT gen_random_uuid(),
        "email"               varchar(255)  NOT NULL,
        "username"            varchar(50)   NOT NULL,
        "password_hash"       varchar(255)  NOT NULL,
        "password_changed_at" timestamptz   NULL,
        "full_name"           varchar(100)  NULL,
        "phone"               varchar(20)   NULL,
        "address"             varchar(255)  NULL,
        "role"                "user_role"   NOT NULL DEFAULT 'USER',
        "status"              "user_status" NOT NULL DEFAULT 'PENDING',
        "email_verified_at"   timestamptz   NULL,
        "created_at"          timestamptz   NOT NULL DEFAULT now(),
        "updated_at"          timestamptz   NOT NULL DEFAULT now(),
        "deleted_at"          timestamptz   NULL,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_users_verified_status"
          CHECK (status <> 'ACTIVE' OR email_verified_at IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_email" ON "users" (lower("email"))
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_username" ON "users" ("username")
        WHERE "deleted_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_status_created_at"
        ON "users" ("status", "created_at" DESC, "id" DESC)
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the table takes its indexes and check constraint with it; the
    // enum types are separate objects and have to be named explicitly.
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "user_status"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
