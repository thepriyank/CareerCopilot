import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, Index
} from 'typeorm'
import { UserJob } from './UserJob'
import { JobListingStatus } from './enums'

/**
 * The global, deduped record of one real job posting — shared across every
 * user who discovers or pastes it. Public data only (title, description,
 * salary, extracted skills); no user-specific state lives here, that's
 * UserJob's job.
 *
 * Replaces the old per-user `JobPosting` (2026-09-06 migration — see
 * `docs/F4_job_search_and_match_plan.md`'s Phase 0). Two users who discover
 * the same real posting now share one row, keyed by `urlHash`, instead of
 * each getting their own independent copy — see `services/jobs/jobIdentity.ts`
 * for how that hash is derived and `services/jobs/jobView.ts` for how a
 * per-user view is joined back together from this + UserJob.
 *
 * `skills` / `normalizedFields` are populated once, at ingestion, by
 * `services/skills/extractJobSkills.ts` (Tier A of the 2026-09-06 matching
 * redesign) — extracted here instead of per-user precisely because this row
 * is now shared: one AI call serves every user who has this job, not one
 * call per user.
 */
@Entity('job_listings')
@Index(['status', 'firstSeenAt'])
@Index(['status', 'expiredAt'])
export class JobListing {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  source!: string

  // Canonicalized (see jobIdentity.ts) but still the real URL, kept for
  // display/debugging. Null for a pasted job with no link — see urlHash's
  // comment for how dedup degrades in that case.
  @Column({ nullable: true, type: 'varchar' })
  url!: string | null

  // sha256 of the canonicalized URL — the actual dedup key (unique). A
  // pasted job with no URL gets a random, never-repeating hash instead: it
  // can't be deduped against anything (there's nothing to key on), which
  // matches today's behavior where manual paste never deduped either.
  @Column({ unique: true })
  urlHash!: string

  @Column()
  title!: string

  @Column({ nullable: true, type: 'varchar' })
  company!: string | null

  @Column({ nullable: true, type: 'varchar' })
  location!: string | null

  @Column({ nullable: true, type: 'varchar' })
  salary!: string | null

  // 2026-09-21 matching redesign: structured salary, extracted once by the
  // same LLM call as skills/seniority (services/skills/extractJobSkills.ts)
  // from whichever of the JD text or the scraper-provided `salary` string
  // actually states it. Replaces regex-parsing `salary` at match time
  // (matchScore.ts's old parseSalaryRange-on-job-salary path) with a number
  // computed once, correctly, at ingestion — and lets matching reject a
  // currency the candidate never asked about instead of comparing raw
  // digits across currencies. Null when neither source states a figure.
  @Column({ type: 'int', nullable: true })
  salaryMin!: number | null

  @Column({ type: 'int', nullable: true })
  salaryMax!: number | null

  @Column({ nullable: true, type: 'varchar' })
  salaryCurrency!: string | null

  // Explicit years-of-experience range the JD itself states (e.g. "5-8
  // years", "8+ years" -> {min: 8, max: null}) — extracted by the same LLM
  // call, only populated when the JD is actually explicit about it. When
  // null, matching falls back to a tier-based band derived from
  // `experienceLevel` below. See services/matching/experienceFit.ts.
  @Column({ type: 'int', nullable: true })
  minYearsExperience!: number | null

  @Column({ type: 'int', nullable: true })
  maxYearsExperience!: number | null

  @Column({ type: 'text' })
  description!: string

  @Column({ type: 'jsonb', default: '{}' })
  normalizedFields!: Record<string, unknown>

  // Native Postgres text[] (2026-09-07 — was `simple-array`; see
  // docs/architecture_hardening_plan.md's Phase 4). GIN-indexed below for
  // future containment queries (`@>`) now that Tier A gives this column
  // real, canonical-ish skill names worth querying on.
  @Column({ type: 'text', array: true, default: '{}' })
  skills!: string[]

  // Seniority tier — one of classifyTier.ts's SeniorityTier values (intern /
  // entry / mid / senior / staff / principal / director / manager). Prior to
  // the 2026-09-21 matching redesign this was always `classifyTier(title)`
  // (a title-keyword regex). It's now the LLM's holistic judgment from the
  // full JD + title + any stated years of experience
  // (services/skills/extractJobSkills.ts), which is what lets it actually
  // tell "Senior" from "Staff" from "Director" — classifyTier(title) only
  // remains as the ingestion-time fallback when every LLM provider fails
  // (see discoveryService.ts's upsertJobListing). Plain varchar, not an
  // enum column, so classifyTier.ts's tier set can grow without a migration.
  @Column({ nullable: true, type: 'varchar' })
  experienceLevel!: string | null

  @Column({ nullable: true, type: 'boolean' })
  isRemote!: boolean | null

  @Column({ nullable: true, type: 'timestamp' })
  postedAt!: Date | null

  // When this exact posting (by urlHash) was first seen by anyone, and last
  // re-confirmed present by a discovery run — distinct from `createdAt`,
  // which TypeORM would only set once and never touch again. Not yet
  // consumed by any staleness/pruning logic (that's Phase 2), but cheap to
  // start recording now rather than backfill later.
  @CreateDateColumn()
  firstSeenAt!: Date

  @UpdateDateColumn()
  lastSeenAt!: Date

  // Phase 2 staleness/expiry (2026-09-17) — see services/jobs/jobCleanup.ts.
  // A listing flips ACTIVE -> EXPIRED once `firstSeenAt` is >= STALE_DAYS old
  // (not `lastSeenAt`: a listing a discovery run keeps re-confirming present
  // is still exactly as old as when it was first posted/found, re-seeing it
  // doesn't make it a fresher posting). `expiredAt` records when that flip
  // happened, so the weekly purge job knows which EXPIRED rows have sat long
  // enough (PURGE_AFTER_EXPIRED_DAYS) to hard-delete.
  @Column({ type: 'enum', enum: JobListingStatus, default: JobListingStatus.ACTIVE })
  status!: JobListingStatus

  @Column({ nullable: true, type: 'timestamp' })
  expiredAt!: Date | null

  // 2026-09-22 link-health check (Jira NM-26) — see
  // services/jobs/linkHealthCheck.ts. `lastLinkCheckedAt` is what the daily
  // check batches on (oldest/never-checked first), independent of
  // `lastSeenAt` (which only reflects re-discovery, not link validity).
  // `linkCheckFailureCount` counts consecutive *ambiguous* failures (403/
  // 429/timeout/5xx — could just be bot-blocking, not necessarily a dead
  // link) across separate daily runs; it takes 2 to flip the listing to
  // EXPIRED. A clean 404/410 is unambiguous and expires the listing
  // immediately without needing this counter at all.
  @Column({ nullable: true, type: 'timestamp' })
  lastLinkCheckedAt!: Date | null

  @Column({ type: 'int', default: 0 })
  linkCheckFailureCount!: number

  @OneToMany(() => UserJob, (uj) => uj.jobListing)
  userJobs!: UserJob[]
}
