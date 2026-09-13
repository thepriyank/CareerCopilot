import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToMany, Unique
} from 'typeorm'
import { JobOrigin } from './enums'
import { User } from './User'
import { JobListing } from './JobListing'
import { MatchResult } from './MatchResult'
import { GeneratedResumeVersion } from './GeneratedResumeVersion'
import { GeneratedCoverLetter } from './GeneratedCoverLetter'

/**
 * One user's relationship to one JobListing — "Priyank has this job in his
 * list, discovered on 2026-09-06." Everything genuinely per-user about a job
 * lives here or on rows that key off this table's `id` (MatchResult,
 * SkillGapReport, tailored resumes, cover letters); everything true about
 * the posting regardless of who's looking lives on JobListing instead.
 *
 * Routes address a job by THIS row's id (`GET /api/jobs/:id` etc.), not
 * JobListing's — see `services/jobs/jobView.ts`'s `JobView`, which joins the
 * two back into the same flat shape the API returned before this migration
 * (2026-09-06, replacing the old per-user `JobPosting` — see
 * `docs/F4_job_search_and_match_plan.md`'s Phase 0). Existing FKs on
 * MatchResult/GeneratedResumeVersion/GeneratedCoverLetter that used to point
 * at a JobPosting row now point at a UserJob row instead — a match score or
 * tailored resume is inherently per-user, and a UserJob row already resolves
 * to exactly one user, so no separate `userId` cross-check is needed on
 * those tables.
 */
@Entity('user_jobs')
@Unique(['userId', 'jobListingId'])
export class UserJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.userJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column()
  jobListingId!: string

  // No onDelete cascade from JobListing's side — a shared listing outliving
  // any one user's reference to it is the whole point of splitting this out.
  @ManyToOne(() => JobListing, (jl) => jl.userJobs)
  @JoinColumn({ name: 'jobListingId' })
  jobListing!: JobListing

  @Column({ type: 'enum', enum: JobOrigin })
  origin!: JobOrigin

  // Set when the candidate marks this job as applied (see PUT
  // /api/jobs/:id/applied); null when not applied. A deliberate, separate
  // action from opening the original posting — clicking "Apply" never sets
  // this on its own.
  @Column({ type: 'timestamp', nullable: true })
  appliedAt!: Date | null

  @CreateDateColumn()
  createdAt!: Date

  @OneToMany(() => MatchResult, (mr) => mr.job)
  matchResults!: MatchResult[]

  @OneToMany(() => GeneratedResumeVersion, (gr) => gr.job)
  generatedResumes!: GeneratedResumeVersion[]

  @OneToMany(() => GeneratedCoverLetter, (gc) => gc.job)
  generatedLetters!: GeneratedCoverLetter[]
}
