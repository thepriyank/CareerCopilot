import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToOne, JoinColumn
} from 'typeorm'
import { RemotePreference, SearchUrgency } from './enums'
import { User } from './User'

@Entity('candidate_profiles')
export class CandidateProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  userId!: string

  @OneToOne(() => User, (u) => u.candidateProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  // Native Postgres text[] (2026-09-07 — was `simple-array`, a single
  // comma-joined string column: no indexing, no containment queries, and a
  // value containing a comma silently corrupted the row). See
  // docs/architecture_hardening_plan.md's Phase 4.
  @Column({ type: 'text', array: true, default: '{}' })
  targetRoles!: string[]

  @Column({ type: 'text', array: true, default: '{}' })
  industries!: string[]

  @Column({ type: 'text', array: true, default: '{}' })
  locations!: string[]

  @Column({ type: 'enum', enum: RemotePreference, default: RemotePreference.OPEN })
  remotePreference!: RemotePreference

  @Column({ type: 'int', nullable: true })
  salaryMin!: number | null

  @Column({ type: 'int', nullable: true })
  salaryMax!: number | null

  @Column({ default: 'USD' })
  salaryCurrency!: string

  @Column({ type: 'enum', enum: SearchUrgency, default: SearchUrgency.ACTIVELY_LOOKING })
  urgency!: SearchUrgency

  @Column({ nullable: true, type: 'varchar' })
  noticePeriod!: string | null

  @Column({ nullable: true, type: 'varchar' })
  visaStatus!: string | null

  @Column({ type: 'text', nullable: true })
  summary!: string | null

  @Column({ default: 0 })
  completionScore!: number

  @Column({ default: 'WELCOME' })
  onboardingState!: string

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
