import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2026-09-22 — in-app notifications (pass-expiry warning is the first
 * use). See entities/Notification.ts and
 * services/notifications/passExpiryNotifier.ts.
 */
export class AddNotifications1790300000000 implements MigrationInterface {
    name = 'AddNotifications1790300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('PASS_EXPIRING')`);
        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid NOT NULL,
                "type" "public"."notifications_type_enum" NOT NULL,
                "title" character varying NOT NULL,
                "body" text NOT NULL,
                "meta" jsonb,
                "readAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_notifications_userId_readAt" ON "notifications" ("userId", "readAt")`);
        await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD CONSTRAINT "FK_notifications_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_notifications_userId_readAt"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    }

}
