import 'reflect-metadata'
import path from 'path'
import { DataSource } from 'typeorm'
import { config } from './index'
import { User } from '../entities/User'
import { ResumeFile } from '../entities/ResumeFile'
import { ParsedResume } from '../entities/ParsedResume'
import { CandidateProfile } from '../entities/CandidateProfile'
import { JobListing } from '../entities/JobListing'
import { UserJob } from '../entities/UserJob'
import { MatchResult } from '../entities/MatchResult'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../entities/GeneratedCoverLetter'
import { ApprovalRecord } from '../entities/ApprovalRecord'
import { SkillGapReport } from '../entities/SkillGapReport'
import { CourseRecommendation } from '../entities/CourseRecommendation'
import { LinkedInReviewReport } from '../entities/LinkedInReviewReport'
import { ModelUsageRecord } from '../entities/ModelUsageRecord'

// 2026-09-07 architecture hardening: `synchronize: true` is retired. It let
// TypeORM silently drop/alter columns on any entity change with no rollback
// path and no review step — fine for pre-launch solo-dev velocity, a real
// risk the moment production data exists. Every schema change from here on
// is a committed migration file under src/migrations/ — see
// docs/architecture_hardening_plan.md's Phase 3, and package.json's
// `migration:generate` / `migration:run` / `migration:revert` scripts.
// `index.ts` runs pending migrations on boot (`AppDataSource.runMigrations()`)
// so `npm run dev` still "just works" locally with no manual step.
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  logging: config.nodeEnv === 'development' ? ['error', 'warn'] : ['error'],
  entities: [
    User,
    ResumeFile,
    ParsedResume,
    CandidateProfile,
    JobListing,
    UserJob,
    MatchResult,
    GeneratedResumeVersion,
    GeneratedCoverLetter,
    ApprovalRecord,
    SkillGapReport,
    CourseRecommendation,
    LinkedInReviewReport,
    ModelUsageRecord,
  ],
  subscribers: [],
})
