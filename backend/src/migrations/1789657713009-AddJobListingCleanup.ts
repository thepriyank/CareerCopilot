import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Phase 2 job-listing staleness/expiry (2026-09-17) — see
 * services/jobs/jobCleanup.ts. Adds `status`/`expiredAt` to `job_listings`
 * plus two supporting indexes, and switches five FK constraints that used
 * to be `ON DELETE NO ACTION` to `CASCADE` (or, for `extension_fills`,
 * `SET NULL`) so a purged JobListing takes its now-meaningless per-user
 * data (UserJob, MatchResult, GeneratedResumeVersion, GeneratedCoverLetter,
 * ApprovalRecord) with it, while leaving quota-ledger `extension_fills`
 * rows intact with a null job reference — see each entity's updated
 * comment for the reasoning per relation.
 *
 * Generated via `migration:generate` and hand-edited to drop the unrelated
 * `IDX_job_listings_skills_gin` diff the generator always picks up — see
 * `AddGoogleAuthToUsers`'s migration comment for why that index isn't
 * recognized as "expected."
 */
export class AddJobListingCleanup1789657713009 implements MigrationInterface {
    name = 'AddJobListingCleanup1789657713009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_d6167f7d71045ddfcdfadd9f756"`);
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_f1cce6b82871d57ea461208ef72"`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" DROP CONSTRAINT "FK_aacbbdbb1573429f2e63a199017"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP CONSTRAINT "FK_caf796fdb399befe1b83f1d3917"`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" DROP CONSTRAINT "FK_cedbf2bebe0f08b9b9ac485e72c"`);
        await queryRunner.query(`ALTER TABLE "extension_fills" DROP CONSTRAINT "FK_8d606d505c803869250a34f67ef"`);
        await queryRunner.query(`CREATE TYPE "public"."job_listings_status_enum" AS ENUM('ACTIVE', 'EXPIRED')`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "status" "public"."job_listings_status_enum" NOT NULL DEFAULT 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "job_listings" ADD "expiredAt" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_feb018ee05c7f3dcfc7a0faf4c" ON "job_listings" ("status", "expiredAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a3bc6dbf2071eaab9d613360d9" ON "job_listings" ("status", "firstSeenAt") `);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_d6167f7d71045ddfcdfadd9f756" FOREIGN KEY ("resumeVersionId") REFERENCES "generated_resume_versions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_f1cce6b82871d57ea461208ef72" FOREIGN KEY ("coverLetterId") REFERENCES "generated_cover_letters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" ADD CONSTRAINT "FK_aacbbdbb1573429f2e63a199017" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD CONSTRAINT "FK_caf796fdb399befe1b83f1d3917" FOREIGN KEY ("jobListingId") REFERENCES "job_listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" ADD CONSTRAINT "FK_cedbf2bebe0f08b9b9ac485e72c" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extension_fills" ADD CONSTRAINT "FK_8d606d505c803869250a34f67ef" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "extension_fills" DROP CONSTRAINT "FK_8d606d505c803869250a34f67ef"`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" DROP CONSTRAINT "FK_cedbf2bebe0f08b9b9ac485e72c"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP CONSTRAINT "FK_caf796fdb399befe1b83f1d3917"`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" DROP CONSTRAINT "FK_aacbbdbb1573429f2e63a199017"`);
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_f1cce6b82871d57ea461208ef72"`);
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_d6167f7d71045ddfcdfadd9f756"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3bc6dbf2071eaab9d613360d9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feb018ee05c7f3dcfc7a0faf4c"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "expiredAt"`);
        await queryRunner.query(`ALTER TABLE "job_listings" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."job_listings_status_enum"`);
        await queryRunner.query(`ALTER TABLE "extension_fills" ADD CONSTRAINT "FK_8d606d505c803869250a34f67ef" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" ADD CONSTRAINT "FK_cedbf2bebe0f08b9b9ac485e72c" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD CONSTRAINT "FK_caf796fdb399befe1b83f1d3917" FOREIGN KEY ("jobListingId") REFERENCES "job_listings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" ADD CONSTRAINT "FK_aacbbdbb1573429f2e63a199017" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_f1cce6b82871d57ea461208ef72" FOREIGN KEY ("coverLetterId") REFERENCES "generated_cover_letters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_d6167f7d71045ddfcdfadd9f756" FOREIGN KEY ("resumeVersionId") REFERENCES "generated_resume_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
