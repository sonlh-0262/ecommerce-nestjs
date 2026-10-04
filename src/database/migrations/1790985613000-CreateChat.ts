import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChat1790985613000 implements MigrationInterface {
  name = 'CreateChat1790985613000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id"              uuid        NOT NULL DEFAULT gen_random_uuid(),
        "user_id"         uuid        NOT NULL,
        "last_message_at" timestamptz NULL,
        "created_at"      timestamptz NOT NULL DEFAULT now(),
        "updated_at"      timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_conversations_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_conversations_user"
        ON "conversations" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_last_message_at"
        ON "conversations" ("last_message_at" DESC NULLS LAST)
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" uuid          NOT NULL,
        "sender_id"       uuid          NOT NULL,
        "content"         varchar(2000) NOT NULL,
        "read_at"         timestamptz   NULL,
        "created_at"      timestamptz   NOT NULL DEFAULT now(),
        "updated_at"      timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id")
          REFERENCES "conversations" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_messages_sender" FOREIGN KEY ("sender_id")
          REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_messages_content" CHECK (char_length(content) BETWEEN 1 AND 2000)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversation_created_at"
        ON "messages" ("conversation_id", "created_at" DESC, "id" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_unread"
        ON "messages" ("conversation_id")
        WHERE "read_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
  }
}
