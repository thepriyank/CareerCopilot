import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788721791998 implements MigrationInterface {
    name = 'InitialSchema1788721791998'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "job_listings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source" character varying NOT NULL, "url" character varying, "urlHash" character varying NOT NULL, "title" character varying NOT NULL, "company" character varying, "location" character varying, "salary" character varying, "description" text NOT NULL, "normalizedFields" jsonb NOT NULL DEFAULT '{}', "skills" text NOT NULL DEFAULT '', "experienceLevel" character varying, "isRemote" boolean, "postedAt" TIMESTAMP, "firstSeenAt" TIMESTAMP NOT NULL DEFAULT now(), "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c9a9b850a7fc870f202b5557187" UNIQUE ("urlHash"), CONSTRAINT "PK_ce5adead49e5fbf2df55e1917c1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "match_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jobId" uuid NOT NULL, "score" double precision NOT NULL, "rationale" jsonb NOT NULL DEFAULT '{}', "gaps" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_788799fb3b8324d976620b485f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."approval_records_artifacttype_enum" AS ENUM('RESUME_VERSION', 'COVER_LETTER')`);
        await queryRunner.query(`CREATE TYPE "public"."approval_records_status_enum" AS ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "approval_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "artifactType" "public"."approval_records_artifacttype_enum" NOT NULL, "status" "public"."approval_records_status_enum" NOT NULL, "notes" text, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "resumeVersionId" uuid, "coverLetterId" uuid, CONSTRAINT "PK_7893399d577a61001c89d38bf0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."generated_cover_letters_status_enum" AS ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "generated_cover_letters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jobId" uuid NOT NULL, "content" jsonb NOT NULL, "provenance" jsonb NOT NULL DEFAULT '{}', "status" "public"."generated_cover_letters_status_enum" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7c817a38af718693bff542a8cc1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."user_jobs_origin_enum" AS ENUM('MATCHED', 'DISCOVERED', 'PASTED')`);
        await queryRunner.query(`CREATE TABLE "user_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jobListingId" uuid NOT NULL, "origin" "public"."user_jobs_origin_enum" NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_49ba8b644c28a68d173c3fe7f57" UNIQUE ("userId", "jobListingId"), CONSTRAINT "PK_af1127879eb3c67db8c123f0b54" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."generated_resume_versions_type_enum" AS ENUM('ORIGINAL', 'MASTER', 'TAILORED')`);
        await queryRunner.query(`CREATE TYPE "public"."generated_resume_versions_status_enum" AS ENUM('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "generated_resume_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "jobId" uuid, "sourceResumeId" uuid, "content" jsonb NOT NULL, "provenance" jsonb NOT NULL DEFAULT '{}', "diffFromId" uuid, "type" "public"."generated_resume_versions_type_enum" NOT NULL DEFAULT 'MASTER', "status" "public"."generated_resume_versions_status_enum" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_16136be7c91e65642caf8fe0272" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."parsed_resumes_status_enum" AS ENUM('PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW_NEEDED')`);
        await queryRunner.query(`CREATE TABLE "parsed_resumes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "sourceFileId" uuid NOT NULL, "sections" jsonb NOT NULL DEFAULT '[]', "extractedEntities" jsonb NOT NULL DEFAULT '{}', "confidenceScores" jsonb NOT NULL DEFAULT '{}', "rawText" text, "status" "public"."parsed_resumes_status_enum" NOT NULL DEFAULT 'PROCESSING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d26f4a0ebfde33fcae7665bb551" UNIQUE ("sourceFileId"), CONSTRAINT "REL_d26f4a0ebfde33fcae7665bb55" UNIQUE ("sourceFileId"), CONSTRAINT "PK_478bffd66b119af1625d2d34878" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."resume_files_filetype_enum" AS ENUM('PDF', 'DOCX')`);
        await queryRunner.query(`CREATE TABLE "resume_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "fileUrl" character varying NOT NULL, "fileType" "public"."resume_files_filetype_enum" NOT NULL, "fileName" character varying NOT NULL, "fileSize" integer NOT NULL, "uploadedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_13efc66cdf3bf89fffdc27a8502" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."candidate_profiles_remotepreference_enum" AS ENUM('REMOTE', 'HYBRID', 'ONSITE', 'OPEN')`);
        await queryRunner.query(`CREATE TYPE "public"."candidate_profiles_urgency_enum" AS ENUM('ACTIVELY_LOOKING', 'OPEN_TO_OPPORTUNITIES', 'NOT_LOOKING')`);
        await queryRunner.query(`CREATE TABLE "candidate_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "targetRoles" text NOT NULL DEFAULT '', "industries" text NOT NULL DEFAULT '', "locations" text NOT NULL DEFAULT '', "remotePreference" "public"."candidate_profiles_remotepreference_enum" NOT NULL DEFAULT 'OPEN', "salaryMin" integer, "salaryMax" integer, "salaryCurrency" character varying NOT NULL DEFAULT 'USD', "urgency" "public"."candidate_profiles_urgency_enum" NOT NULL DEFAULT 'ACTIVELY_LOOKING', "noticePeriod" character varying, "visaStatus" character varying, "summary" text, "completionScore" integer NOT NULL DEFAULT '0', "onboardingState" character varying NOT NULL DEFAULT 'WELCOME', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_df5454fe06a1630d3ba903a95d8" UNIQUE ("userId"), CONSTRAINT "REL_df5454fe06a1630d3ba903a95d" UNIQUE ("userId"), CONSTRAINT "PK_8e8cf5b54118601673585218cc4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "course_recommendations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "skillGapId" uuid NOT NULL, "provider" character varying NOT NULL, "title" character varying NOT NULL, "url" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0e110873cb7b6f232397ac0e6e5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "skill_gap_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "roleContext" character varying, "jobId" character varying, "missingSkills" jsonb NOT NULL DEFAULT '[]', "existingSkills" jsonb NOT NULL DEFAULT '[]', "supportedByResumeSkills" jsonb NOT NULL DEFAULT '[]', "priorityRanking" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_05b03d2dd988355dddb5e9925bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "linkedin_review_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "sections" jsonb NOT NULL DEFAULT '{}', "suggestions" jsonb NOT NULL DEFAULT '{}', "overallScore" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1293b6101ce45835e8b8da2bd28" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "model_usage_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "modelName" character varying NOT NULL, "apiKeySource" character varying NOT NULL, "tokensUsed" integer NOT NULL, "costEstimate" double precision, "feature" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_11451e9c38a57791efa0b5316b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_plan_enum" AS ENUM('FREE', 'PREMIUM')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying, "region" character varying, "plan" "public"."users_plan_enum" NOT NULL DEFAULT 'FREE', "settings" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "match_results" ADD CONSTRAINT "FK_f80b6e316c13241db663283a640" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_results" ADD CONSTRAINT "FK_d779a5f774681b503443dae2729" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_e61955b0f9cc06a3af05c034000" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_d6167f7d71045ddfcdfadd9f756" FOREIGN KEY ("resumeVersionId") REFERENCES "generated_resume_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "approval_records" ADD CONSTRAINT "FK_f1cce6b82871d57ea461208ef72" FOREIGN KEY ("coverLetterId") REFERENCES "generated_cover_letters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" ADD CONSTRAINT "FK_b4bcde211e9eeb30a0cef3a787e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" ADD CONSTRAINT "FK_aacbbdbb1573429f2e63a199017" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD CONSTRAINT "FK_30a8c613ab76a6f577b8f90a532" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_jobs" ADD CONSTRAINT "FK_caf796fdb399befe1b83f1d3917" FOREIGN KEY ("jobListingId") REFERENCES "job_listings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" ADD CONSTRAINT "FK_194d88d38272987cf6e3ca7555a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" ADD CONSTRAINT "FK_cedbf2bebe0f08b9b9ac485e72c" FOREIGN KEY ("jobId") REFERENCES "user_jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" ADD CONSTRAINT "FK_777900de92118b2da440eea2f84" FOREIGN KEY ("sourceResumeId") REFERENCES "parsed_resumes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parsed_resumes" ADD CONSTRAINT "FK_8f6b26b3a7e9b048edf4580a995" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "parsed_resumes" ADD CONSTRAINT "FK_d26f4a0ebfde33fcae7665bb551" FOREIGN KEY ("sourceFileId") REFERENCES "resume_files"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "resume_files" ADD CONSTRAINT "FK_3a625daff597d9b1b40b66c3cf2" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "candidate_profiles" ADD CONSTRAINT "FK_df5454fe06a1630d3ba903a95d8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course_recommendations" ADD CONSTRAINT "FK_40fa97bd00dc480a95f7c4172a8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course_recommendations" ADD CONSTRAINT "FK_89bb50b895b32238bb2c1a22dcd" FOREIGN KEY ("skillGapId") REFERENCES "skill_gap_reports"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "skill_gap_reports" ADD CONSTRAINT "FK_dcc4b0934ae03d12b57b9ecc0fe" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "linkedin_review_reports" ADD CONSTRAINT "FK_5911c8fd781d12abda3dc4add6f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "model_usage_records" ADD CONSTRAINT "FK_760354e897b682e58c248730771" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "model_usage_records" DROP CONSTRAINT "FK_760354e897b682e58c248730771"`);
        await queryRunner.query(`ALTER TABLE "linkedin_review_reports" DROP CONSTRAINT "FK_5911c8fd781d12abda3dc4add6f"`);
        await queryRunner.query(`ALTER TABLE "skill_gap_reports" DROP CONSTRAINT "FK_dcc4b0934ae03d12b57b9ecc0fe"`);
        await queryRunner.query(`ALTER TABLE "course_recommendations" DROP CONSTRAINT "FK_89bb50b895b32238bb2c1a22dcd"`);
        await queryRunner.query(`ALTER TABLE "course_recommendations" DROP CONSTRAINT "FK_40fa97bd00dc480a95f7c4172a8"`);
        await queryRunner.query(`ALTER TABLE "candidate_profiles" DROP CONSTRAINT "FK_df5454fe06a1630d3ba903a95d8"`);
        await queryRunner.query(`ALTER TABLE "resume_files" DROP CONSTRAINT "FK_3a625daff597d9b1b40b66c3cf2"`);
        await queryRunner.query(`ALTER TABLE "parsed_resumes" DROP CONSTRAINT "FK_d26f4a0ebfde33fcae7665bb551"`);
        await queryRunner.query(`ALTER TABLE "parsed_resumes" DROP CONSTRAINT "FK_8f6b26b3a7e9b048edf4580a995"`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" DROP CONSTRAINT "FK_777900de92118b2da440eea2f84"`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" DROP CONSTRAINT "FK_cedbf2bebe0f08b9b9ac485e72c"`);
        await queryRunner.query(`ALTER TABLE "generated_resume_versions" DROP CONSTRAINT "FK_194d88d38272987cf6e3ca7555a"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP CONSTRAINT "FK_caf796fdb399befe1b83f1d3917"`);
        await queryRunner.query(`ALTER TABLE "user_jobs" DROP CONSTRAINT "FK_30a8c613ab76a6f577b8f90a532"`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" DROP CONSTRAINT "FK_aacbbdbb1573429f2e63a199017"`);
        await queryRunner.query(`ALTER TABLE "generated_cover_letters" DROP CONSTRAINT "FK_b4bcde211e9eeb30a0cef3a787e"`);
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_f1cce6b82871d57ea461208ef72"`);
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_d6167f7d71045ddfcdfadd9f756"`);
        await queryRunner.query(`ALTER TABLE "approval_records" DROP CONSTRAINT "FK_e61955b0f9cc06a3af05c034000"`);
        await queryRunner.query(`ALTER TABLE "match_results" DROP CONSTRAINT "FK_d779a5f774681b503443dae2729"`);
        await queryRunner.query(`ALTER TABLE "match_results" DROP CONSTRAINT "FK_f80b6e316c13241db663283a640"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_plan_enum"`);
        await queryRunner.query(`DROP TABLE "model_usage_records"`);
        await queryRunner.query(`DROP TABLE "linkedin_review_reports"`);
        await queryRunner.query(`DROP TABLE "skill_gap_reports"`);
        await queryRunner.query(`DROP TABLE "course_recommendations"`);
        await queryRunner.query(`DROP TABLE "candidate_profiles"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_profiles_urgency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_profiles_remotepreference_enum"`);
        await queryRunner.query(`DROP TABLE "resume_files"`);
        await queryRunner.query(`DROP TYPE "public"."resume_files_filetype_enum"`);
        await queryRunner.query(`DROP TABLE "parsed_resumes"`);
        await queryRunner.query(`DROP TYPE "public"."parsed_resumes_status_enum"`);
        await queryRunner.query(`DROP TABLE "generated_resume_versions"`);
        await queryRunner.query(`DROP TYPE "public"."generated_resume_versions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."generated_resume_versions_type_enum"`);
        await queryRunner.query(`DROP TABLE "user_jobs"`);
        await queryRunner.query(`DROP TYPE "public"."user_jobs_origin_enum"`);
        await queryRunner.query(`DROP TABLE "generated_cover_letters"`);
        await queryRunner.query(`DROP TYPE "public"."generated_cover_letters_status_enum"`);
        await queryRunner.query(`DROP TABLE "approval_records"`);
        await queryRunner.query(`DROP TYPE "public"."approval_records_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."approval_records_artifacttype_enum"`);
        await queryRunner.query(`DROP TABLE "match_results"`);
        await queryRunner.query(`DROP TABLE "job_listings"`);
    }

}
