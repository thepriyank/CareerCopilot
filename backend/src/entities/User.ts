import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, OneToOne
} from 'typeorm'
import { Plan, PlanTier, AuthProvider } from './enums'
import { ResumeFile } from './ResumeFile'
import { ParsedResume } from './ParsedResume'
import { CandidateProfile } from './CandidateProfile'
import { UserJob } from './UserJob'
import { MatchResult } from './MatchResult'
import { GeneratedResumeVersion } from './GeneratedResumeVersion'
import { GeneratedCoverLetter } from './GeneratedCoverLetter'
import { ApprovalRecord } from './ApprovalRecord'
import { SkillGapReport } from './SkillGapReport'
import { CourseRecommendation } from './CourseRecommendation'
import { LinkedInReviewReport } from './LinkedInReviewReport'
import { ModelUsageRecord } from './ModelUsageRecord'
import { ExtensionToken } from './ExtensionToken'
import { ExtensionFill } from './ExtensionFill'
import { Notification } from './Notification'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  // Nullable since 2026-09-07 (Google sign-in via Firebase) — a
  // Google-only account has no password to check. Every route that
  // authenticates by password (POST /api/auth/login) must treat `null`
  // here as "this account can't use password login," not as a bcrypt
  // comparison to attempt.
  @Column({ nullable: true, type: 'varchar' })
  passwordHash!: string | null

  // Firebase Auth's UID for this user, set the first time they sign in with
  // Google (see routes/auth.routes.ts's POST /google) — unique and nullable
  // (a password-only account never gets one, unless they later link Google
  // to the same email, at which point it's backfilled onto their existing
  // row rather than creating a second account for the same person).
  @Column({ unique: true, nullable: true, type: 'varchar' })
  firebaseUid!: string | null

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.PASSWORD })
  authProvider!: AuthProvider

  @Column({ nullable: true, type: 'varchar' })
  name!: string | null

  @Column({ nullable: true, type: 'varchar' })
  region!: string | null

  @Column({ type: 'enum', enum: Plan, default: Plan.FREE })
  plan!: Plan

  // Expiry for `plan` when it's PREMIUM — null means "does not expire" (a
  // FREE user, or a future non-expiring PREMIUM grant). The free trial
  // sets both `plan = PREMIUM` and this to `now + TRIAL_DURATION_MS`
  // together; nothing else should ever read `plan` on its own to decide
  // entitlement — go through resolveEffectivePlan() in
  // services/plan/resolveEffectivePlan.ts, which treats a past
  // planExpiresAt as FREE regardless of what this column says. See
  // docs/monetization_plan.md.
  @Column({ type: 'timestamp', nullable: true })
  planExpiresAt!: Date | null

  // Which specific pass is behind the current `plan`/`planExpiresAt` grant
  // — see enums.ts's PlanTier comment. Null for a FREE user who's never had
  // one. Set alongside `plan`/`planExpiresAt` at every grant site (signup,
  // POST /api/account/activate-pass, and a captured Razorpay payment via
  // services/payments/applyPassPayment.ts) — never inferred after the fact.
  @Column({ type: 'enum', enum: PlanTier, nullable: true })
  activePlanTier!: PlanTier | null

  @Column({ type: 'jsonb', default: '{}' })
  settings!: Record<string, unknown>

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany(() => ResumeFile, (rf) => rf.user)
  resumeFiles!: ResumeFile[]

  @OneToMany(() => ParsedResume, (pr) => pr.user)
  parsedResumes!: ParsedResume[]

  @OneToOne(() => CandidateProfile, (cp) => cp.user)
  candidateProfile!: CandidateProfile | null

  @OneToMany(() => UserJob, (uj) => uj.user)
  userJobs!: UserJob[]

  @OneToMany(() => MatchResult, (mr) => mr.user)
  matchResults!: MatchResult[]

  @OneToMany(() => GeneratedResumeVersion, (gr) => gr.user)
  generatedResumes!: GeneratedResumeVersion[]

  @OneToMany(() => GeneratedCoverLetter, (gc) => gc.user)
  generatedLetters!: GeneratedCoverLetter[]

  @OneToMany(() => ApprovalRecord, (ar) => ar.user)
  approvalRecords!: ApprovalRecord[]

  @OneToMany(() => SkillGapReport, (sg) => sg.user)
  skillGapReports!: SkillGapReport[]

  @OneToMany(() => CourseRecommendation, (cr) => cr.user)
  courseRecommendations!: CourseRecommendation[]

  @OneToMany(() => LinkedInReviewReport, (li) => li.user)
  linkedInReviews!: LinkedInReviewReport[]

  @OneToMany(() => ModelUsageRecord, (mu) => mu.user)
  modelUsageRecords!: ModelUsageRecord[]

  @OneToMany(() => ExtensionToken, (et) => et.user)
  extensionTokens!: ExtensionToken[]

  @OneToMany(() => ExtensionFill, (ef) => ef.user)
  extensionFills!: ExtensionFill[]

  @OneToMany(() => Notification, (n) => n.user)
  notifications!: Notification[]
}
