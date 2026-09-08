import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany
} from 'typeorm'
import { UserJob } from './UserJob'

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

  @OneToMany(() => UserJob, (uj) => uj.jobListing)
  userJobs!: UserJob[]
}
