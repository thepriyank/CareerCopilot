import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `users.activePlanTier` (2026-09-19) — which specific pass (TRIAL,
 * ONE_MONTH, THREE_MONTH, ANNUAL) is behind a PREMIUM user's current
 * `plan`/`planExpiresAt` grant. See entities/enums.ts's PlanTier comment
 * and services/payments/applyPassPayment.ts.
 *
 * Generated via `migration:generate` and hand-edited to drop the unrelated
 * `IDX_job_listings_skills_gin` diff the generator always picks up — see
 * `AddGoogleAuthToUsers`'s migration comment for why that index isn't
 * recognized as "expected."
 */
export class AddPlanTierTracking1789827861725 implements MigrationInterface {
    name = 'AddPlanTierTracking1789827861725'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_activeplantier_enum" AS ENUM('TRIAL', 'ONE_MONTH', 'THREE_MONTH', 'ANNUAL')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "activePlanTier" "public"."users_activeplantier_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "activePlanTier"`);
        await queryRunner.query(`DROP TYPE "public"."users_activeplantier_enum"`);
    }

}
