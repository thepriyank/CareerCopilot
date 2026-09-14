import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `field_mapping_cache` (2026-09-14) — the Tier-2 generic field-mapping
 * cache, the v1 mechanism the Assisted Apply extension ships alone (no
 * per-ATS adapters — see "Field mapping" in
 * docs/assisted_apply_extension_plan.md). Keyed globally by
 * `(hostname, schemaHash)`, never by user — one distinct form template
 * costs one LLM call ever, across every user who meets it.
 *
 * Generated via `migration:generate` and hand-edited to drop the unrelated
 * `IDX_job_listings_skills_gin` diff the generator always picks up — see
 * `AddGoogleAuthToUsers`'s migration comment for why that index isn't
 * recognized as "expected."
 */
export class AddFieldMappingCache1789370201070 implements MigrationInterface {
    name = 'AddFieldMappingCache1789370201070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "field_mapping_cache" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hostname" character varying NOT NULL, "schemaHash" character varying NOT NULL, "mapping" jsonb NOT NULL, "hitCount" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_730f3f85a9014d6aa5e94e484a5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fed729cfca9bc8d75a0f09d26e" ON "field_mapping_cache" ("hostname", "schemaHash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fed729cfca9bc8d75a0f09d26e"`);
        await queryRunner.query(`DROP TABLE "field_mapping_cache"`);
    }

}
