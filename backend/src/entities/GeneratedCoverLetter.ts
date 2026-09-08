import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany
} from 'typeorm'
import { ArtifactStatus } from './enums'
import { User } from './User'
import { UserJob } from './UserJob'
import { ApprovalRecord } from './ApprovalRecord'

@Entity('generated_cover_letters')
export class GeneratedCoverLetter {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.generatedLetters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  // Points at a UserJob row — see MatchResult.ts's comment on why UserJob,
  // not JobListing.
  @Column()
  jobId!: string

  @ManyToOne(() => UserJob, (uj) => uj.generatedLetters)
  @JoinColumn({ name: 'jobId' })
  job!: UserJob

  @Column({ type: 'jsonb' })
  content!: Record<string, unknown>

  @Column({ type: 'jsonb', default: '{}' })
  provenance!: Record<string, unknown>

  @Column({ type: 'enum', enum: ArtifactStatus, default: ArtifactStatus.DRAFT })
  status!: ArtifactStatus

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany(() => ApprovalRecord, (ar) => ar.coverLetter)
  approvalRecords!: ApprovalRecord[]
}
