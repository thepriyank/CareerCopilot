import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2026-09-24 — NM-29: LLM model catalog + alert de-dup state, and usage
 * records for calls with no user. See docs/NM-29_plan.md.
 */
export class AddLlmModelCatalog1790400000000 implements MigrationInterface {
    name = 'AddLlmModelCatalog1790400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."llm_model_catalog_status_enum" AS ENUM('ACTIVE', 'RATE_LIMITED', 'UNAVAILABLE', 'FAILED_QUALITY', 'RETIRED')`);
        await queryRunner.query(`
            CREATE TABLE "llm_model_catalog" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "providerId" character varying NOT NULL,
                "modelId" character varying NOT NULL,
                "status" "public"."llm_model_catalog_status_enum" NOT NULL,
                "rank" integer NOT NULL DEFAULT 1000,
                "isFree" boolean NOT NULL DEFAULT true,
                "isReasoning" boolean NOT NULL DEFAULT false,
                "contextWindow" integer,
                "maxOutputTokens" integer,
                "lastSeenAt" TIMESTAMP,
                "lastProbeAt" TIMESTAMP,
                "lastProbeResult" character varying,
                "lastProbeLatencyMs" integer,
                "consecutiveFailures" integer NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_llm_model_catalog_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_llm_model_catalog_provider_model" ON "llm_model_catalog" ("providerId", "modelId")`);
        await queryRunner.query(`
            CREATE TABLE "llm_provider_alerts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "alertKey" character varying NOT NULL,
                "message" text NOT NULL,
                "firstSeenAt" TIMESTAMP NOT NULL DEFAULT now(),
                "lastSentAt" TIMESTAMP NOT NULL,
                "resolvedAt" TIMESTAMP,
                CONSTRAINT "PK_llm_provider_alerts_id" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_llm_provider_alerts_key_resolved" ON "llm_provider_alerts" ("alertKey", "resolvedAt")`);
        await queryRunner.query(`ALTER TABLE "model_usage_records" ALTER COLUMN "userId" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "model_usage_records" WHERE "userId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "model_usage_records" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_llm_provider_alerts_key_resolved"`);
        await queryRunner.query(`DROP TABLE "llm_provider_alerts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_llm_model_catalog_provider_model"`);
        await queryRunner.query(`DROP TABLE "llm_model_catalog"`);
        await queryRunner.query(`DROP TYPE "public"."llm_model_catalog_status_enum"`);
    }
}
