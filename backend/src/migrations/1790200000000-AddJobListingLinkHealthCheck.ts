import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2026-09-22 — link-health check (Jira NM-26). Adds `lastLinkCheckedAt` /
 * `linkCheckFailureCount` to `job_listings` — see
 * services/jobs/linkHealthCheck.ts. Purely additive/nullable-or-defaulted,
 * no backfill needed: every existing row is simply "never checked yet"
 * (lastLinkCheckedAt null), which is exactly what the batch-selection query
 * already treats as highest priority.
 */
export class AddJobListingLinkHealthCheck1790200000000 implements MigrationInterface {
    name = 'AddJobListingLinkHealthCheck1790200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "lastLinkCheckedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "linkCheckFailureCount" integer NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "linkCheckFailureCount"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "lastLinkCheckedAt"`);
    }

}
