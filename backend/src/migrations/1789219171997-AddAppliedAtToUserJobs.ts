import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `appliedAt` to user_jobs (2026-09-12) — lets a candidate mark a job
 * as applied (nullable timestamp; null = not applied). See UserJob.ts's
 * comment, jobView.ts's JobView.appliedAt, and routes/jobs.routes.ts's
 * PUT /:id/applied.
 */
export class AddAppliedAtToUserJobs1789219171997 implements MigrationInterface {
    name = 'AddAppliedAtToUserJobs1789219171997'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD "appliedAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP COLUMN "appliedAt"`);
    }

}
