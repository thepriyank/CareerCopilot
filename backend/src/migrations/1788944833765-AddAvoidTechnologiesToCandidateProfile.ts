import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `avoidTechnologies` to candidate_profiles (2026-09-09 — see
 * CandidateProfile.ts's comment, routes/profile.routes.ts's onboarding flow,
 * services/matching/avoidedTechFilter.ts for how it's used).
 *
 * Hand-edited from the auto-generated version, same recurring issue as
 * AddGoogleAuthToUsers1788775819815: the generator also wanted to DROP
 * `IDX_job_listings_skills_gin` (raw-SQL-created, not an entity `@Index`,
 * so TypeORM's diff doesn't recognize it as expected) and its `down()`
 * would have recreated it as a plain btree index, silently losing the GIN
 * method on a rollback. Removed both — this migration has nothing to do
 * with that index.
 */
export class AddAvoidTechnologiesToCandidateProfile1788944833765 implements MigrationInterface {
    name = 'AddAvoidTechnologiesToCandidateProfile1788944833765'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_profiles" ADD "avoidTechnologies" text array NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidate_profiles" DROP COLUMN "avoidTechnologies"`);
    }

}
