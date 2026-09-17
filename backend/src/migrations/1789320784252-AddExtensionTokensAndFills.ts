import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `extension_tokens` and `extension_fills` (2026-09-13) — the
 * Assisted Apply browser extension's backend, Phase 0b; see
 * docs/assisted_apply_extension_plan.md. `extension_tokens` holds only a
 * SHA-256 hash of each revocable extension credential, never the
 * plaintext. `extension_fills` is both the quota ledger (how many autofills
 * a FREE user has used this rolling month) and the idempotency key (a
 * repeat POST /api/extension/fills for the same normalized URL within 24h
 * reuses the existing row instead of charging again) — see
 * services/extension/quota.ts.
 *
 * Generated via `migration:generate` and hand-edited to drop the unrelated
 * `IDX_job_listings_skills_gin` diff the generator always picks up — see
 * `AddGoogleAuthToUsers`'s migration comment for why that index isn't
 * recognized as "expected."
 */
export class AddExtensionTokensAndFills1789320784252 implements MigrationInterface {
    name = 'AddExtensionTokensAndFills1789320784252'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "extension_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "label" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, "revokedAt" TIMESTAMP, CONSTRAINT "UQ_cce76c0593a5d9b241298c604ef" UNIQUE ("tokenHash"), CONSTRAINT "PK_92d543144795c8843228fe09cc2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "extension_fills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "normalizedUrl" character varying NOT NULL, "jobId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2356f86cc25670f6b77f217d69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_74a963b6ee8b1cd0614b323017" ON "extension_fills" ("userId", "normalizedUrl") `);
        await queryRunner.query(`ALTER TABLE "extension_tokens" ADD CONSTRAINT "FK_0fc6b5c681c93dbea2ce867030f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extension_fills" ADD CONSTRAINT "FK_c6f42e44ea823ebbcafcee670a3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "extension_fills" ADD CONSTRAINT "FK_8d606d505c803869250a34f67ef" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "extension_fills" DROP CONSTRAINT "FK_8d606d505c803869250a34f67ef"`);
        await queryRunner.query(`ALTER TABLE "extension_fills" DROP CONSTRAINT "FK_c6f42e44ea823ebbcafcee670a3"`);
        await queryRunner.query(`ALTER TABLE "extension_tokens" DROP CONSTRAINT "FK_0fc6b5c681c93dbea2ce867030f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_74a963b6ee8b1cd0614b323017"`);
        await queryRunner.query(`DROP TABLE "extension_fills"`);
        await queryRunner.query(`DROP TABLE "extension_tokens"`);
    }

}
