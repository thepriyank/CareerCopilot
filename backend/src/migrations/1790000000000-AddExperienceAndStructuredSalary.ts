import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2026-09-21 job-matching redesign — see docs/F4_job_search_and_match_plan.md
 * and matchScore.ts's v4 header comment for the full rationale. Adds:
 *
 * - `candidate_profiles.yearsOfExperience` — explicit onboarding answer, the
 *   one non-negotiable "how senior am I" signal on the candidate side.
 * - `job_listings.minYearsExperience` / `maxYearsExperience` — explicit
 *   years-of-experience range the JD states, LLM-extracted.
 * - `job_listings.salaryMin` / `salaryMax` / `salaryCurrency` — structured
 *   salary, LLM-extracted from the JD text and/or the scraper-provided
 *   `salary` string, replacing regex-parsing of `salary` at match time.
 *
 * No backfill: pre-existing `job_listings` rows keep these columns null
 * until next re-ingested (AI-derived fields are set once at ingestion, never
 * retroactively — see discoveryService.ts's upsertJobListing comment), and
 * there are no real candidate users yet to backfill `yearsOfExperience` for
 * either (2026-09-21 product decision — pre-launch).
 */
export class AddExperienceAndStructuredSalary1790000000000 implements MigrationInterface {
    name = 'AddExperienceAndStructuredSalary1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_profiles" ADD "yearsOfExperience" integer`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "salaryMin" integer`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "salaryMax" integer`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "salaryCurrency" character varying`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "minYearsExperience" integer`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "maxYearsExperience" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "maxYearsExperience"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "minYearsExperience"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "salaryCurrency"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "salaryMax"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "salaryMin"`);
        await queryRunner.query(`ALTER TABLE "candidate_profiles" DROP COLUMN "yearsOfExperience"`);
    }

}
