import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachments1790985602000 implements MigrationInterface {
  name = 'CreateAttachments1790985602000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id"              uuid              NOT NULL DEFAULT gen_random_uuid(),
        "attachable_type" "attachable_type" NOT NULL,
        "attachable_id"   uuid              NOT NULL,
        "url"             varchar(500)      NOT NULL,
        "file_name"       varchar(255)      NOT NULL,
        "file_type"       varchar(100)      NOT NULL,
        "file_size"       integer           NOT NULL,
        "storage_path"    varchar(500)      NOT NULL,
        "created_at"      timestamptz       NOT NULL DEFAULT now(),
        "updated_at"      timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_attachments_file_size" CHECK (file_size > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_attachments_attachable"
        ON "attachments" ("attachable_type", "attachable_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_attachments_avatar"
        ON "attachments" ("attachable_id")
        WHERE "attachable_type" = 'User'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "attachments"`);
  }
}
