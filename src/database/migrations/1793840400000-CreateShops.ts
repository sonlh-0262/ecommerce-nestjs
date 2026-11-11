import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShops1793840400000 implements MigrationInterface {
  name = 'CreateShops1793840400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "shop_status" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "shops" (
        "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
        "owner_id"         uuid          NOT NULL,
        "name"             varchar(100)  NOT NULL,
        "slug"             varchar(120)  NOT NULL,
        "description"      text          NULL,
        "phone"            varchar(20)   NOT NULL,
        "address"          varchar(255)  NOT NULL,
        "status"           "shop_status" NOT NULL DEFAULT 'PENDING',
        "rejection_reason" varchar(500)  NULL,
        "reviewed_by"      uuid          NULL,
        "reviewed_at"      timestamptz   NULL,
        "created_at"       timestamptz   NOT NULL DEFAULT now(),
        "updated_at"       timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shops_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shops_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_shops_reviewer" FOREIGN KEY ("reviewed_by")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_shops_reviewed"
          CHECK ((status = 'PENDING') = (reviewed_at IS NULL)),
        CONSTRAINT "CHK_shops_rejection_reason"
          CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shops_owner_id" ON "shops" ("owner_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_shops_slug" ON "shops" ("slug")`,
    );
    await queryRunner.query(`
      CREATE INDEX "IDX_shops_status_created_at"
        ON "shops" ("status", "created_at" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shops"`);
    await queryRunner.query(`DROP TYPE "shop_status"`);
  }
}
