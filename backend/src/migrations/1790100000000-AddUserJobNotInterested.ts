import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2026-09-21 — "not interested" job-dismissal feature (see UserJob.ts's
 * comment and routes/jobs.routes.ts's PUT/DELETE /:id/not-interested).
 * Adds `notInterestedAt`/`notInterestedReason`/`notInterestedNote` to
 * `user_jobs`. Purely additive/nullable — no backfill needed, no existing
 * behavior changes until a candidate actually uses the new action.
 */
export class AddUserJobNotInterested1790100000000 implements MigrationInterface {
    name = 'AddUserJobNotInterested1790100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_jobs_notinterestedreason_enum" AS ENUM('ROLE_TOO_JUNIOR', 'ROLE_TOO_SENIOR', 'SALARY_TOO_LOW', 'LOCATION_MISMATCH', 'SKILLS_MISMATCH', 'WRONG_ROLE_TYPE', 'COMPANY', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD "notInterestedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD "notInterestedReason" "public"."user_jobs_notinterestedreason_enum"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD "notInterestedNote" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP COLUMN "notInterestedNote"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP COLUMN "notInterestedReason"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP COLUMN "notInterestedAt"`);
        await queryRunner.query(`DROP TYPE "public"."user_jobs_notinterestedreason_enum"`);
    }

}
