import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategories1790985603000 implements MigrationInterface {
  name = 'CreateCategories1790985603000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id"         uuid         NOT NULL DEFAULT gen_random_uuid(),
        "name"       varchar(100) NOT NULL,
        "slug"       varchar(120) NOT NULL,
        "parent_id"  uuid         NULL,
        "is_active"  boolean      NOT NULL DEFAULT true,
        "created_at" timestamptz  NOT NULL DEFAULT now(),
        "updated_at" timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categories_parent" FOREIGN KEY ("parent_id")
          REFERENCES "categories" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_categories_parent_not_self"
          CHECK (parent_id IS NULL OR parent_id <> id)
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_slug" ON "categories" ("slug")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_categories_name_parent"
        ON "categories" (lower("name"), "parent_id") NULLS NOT DISTINCT
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_categories_parent_id" ON "categories" ("parent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
