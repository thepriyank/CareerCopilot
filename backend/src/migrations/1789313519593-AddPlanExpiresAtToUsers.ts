import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `planExpiresAt` to users (2026-09-13) — the one-month full-access
 * pass; see docs/monetization_plan.md. Nullable: null means either no pass
 * has ever been granted (a pre-existing user until they opt in via
 * POST /api/account/activate-pass) or, for a PREMIUM user, "does not
 * expire." Read only through services/plan/resolveEffectivePlan.ts —
 * nothing else should compare it directly.
 */
export class AddPlanExpiresAtToUsers1789313519593 implements MigrationInterface {
    name = 'AddPlanExpiresAtToUsers1789313519593'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "planExpiresAt" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "planExpiresAt"`);
    }

}
