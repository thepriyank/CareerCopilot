import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany
} from 'typeorm'
import { ArtifactStatus, ResumeVersionType } from './enums'
import { User } from './User'
import { UserJob } from './UserJob'
import { ParsedResume } from './ParsedResume'
import { ApprovalRecord } from './ApprovalRecord'

@Entity('generated_resume_versions')
export class GeneratedResumeVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.generatedResumes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  // Points at a UserJob row (null for a master resume, which has no job) —
  // see MatchResult.ts's comment on why UserJob, not JobListing.
  @Column({ nullable: true, type: 'uuid' })
  jobId!: string | null

  @ManyToOne(() => UserJob, (uj) => uj.generatedResumes, { nullable: true })
  @JoinColumn({ name: 'jobId' })
  job!: UserJob | null

  @Column({ nullable: true, type: 'uuid' })
  sourceResumeId!: string | null

  @ManyToOne(() => ParsedResume, (pr) => pr.generatedResumes, { nullable: true })
  @JoinColumn({ name: 'sourceResumeId' })
  source!: ParsedResume | null

  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>

  @Column({ type: 'jsonb', default: '{}' })
  provenance!: Record<string, unknown>

  @Column({ nullable: true, type: 'uuid' })
  diffFromId!: string | null

  @Column({ type: 'enum', enum: ResumeVersionType, default: ResumeVersionType.MASTER })
  type!: ResumeVersionType

  @Column({ type: 'enum', enum: ArtifactStatus, default: ArtifactStatus.DRAFT })
  status!: ArtifactStatus

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany(() => ApprovalRecord, (ar) => ar.resumeVersion)
  approvalRecords!: ApprovalRecord[]
}
