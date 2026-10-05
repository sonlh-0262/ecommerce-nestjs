import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductSuggestions1790985612000 implements MigrationInterface {
  name = 'CreateProductSuggestions1790985612000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_suggestions" (
        "id"            uuid                NOT NULL DEFAULT gen_random_uuid(),
        "user_id"       uuid                NOT NULL,
        "name"          varchar(255)        NOT NULL,
        "description"   text                NOT NULL,
        "reference_url" varchar(500)        NULL,
        "status"        "suggestion_status" NOT NULL DEFAULT 'PENDING',
        "admin_note"    varchar(500)        NULL,
        "reviewed_by"   uuid                NULL,
        "reviewed_at"   timestamptz         NULL,
        "created_at"    timestamptz         NOT NULL DEFAULT now(),
        "updated_at"    timestamptz         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_suggestions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_suggestions_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_product_suggestions_reviewer" FOREIGN KEY ("reviewed_by")
          REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_product_suggestions_reviewed"
          CHECK ((status = 'PENDING') = (reviewed_at IS NULL))
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_product_suggestions_user_created_at"
        ON "product_suggestions" ("user_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_product_suggestions_status_created_at"
        ON "product_suggestions" ("status", "created_at" DESC, "id" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_suggestions"`);
  }
}
