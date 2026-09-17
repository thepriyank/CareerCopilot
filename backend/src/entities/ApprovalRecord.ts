import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { ArtifactType, ArtifactStatus } from './enums'
import { User } from './User'
import { GeneratedResumeVersion } from './GeneratedResumeVersion'
import { GeneratedCoverLetter } from './GeneratedCoverLetter'

@Entity('approval_records')
export class ApprovalRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.approvalRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ type: 'enum', enum: ArtifactType })
  artifactType!: ArtifactType

  @Column({ type: 'enum', enum: ArtifactStatus })
  status!: ArtifactStatus

  @Column({ type: 'text', nullable: true })
  notes!: string | null

  @CreateDateColumn()
  timestamp!: Date

  // Both CASCADE (2026-09-17): an approval record about a resume version or
  // cover letter that no longer exists (e.g. deleted along with its job via
  // services/jobs/jobCleanup.ts) is a dangling reference, not useful history
  // on its own — exactly one of the two is ever set for a given record.
  @Column({ nullable: true, type: 'uuid' })
  resumeVersionId!: string | null

  @ManyToOne(() => GeneratedResumeVersion, (grv) => grv.approvalRecords, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resumeVersionId' })
  resumeVersion!: GeneratedResumeVersion | null

  @Column({ nullable: true, type: 'uuid' })
  coverLetterId!: string | null

  @ManyToOne(() => GeneratedCoverLetter, (gcl) => gcl.approvalRecords, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'coverLetterId' })
  coverLetter!: GeneratedCoverLetter | null
}
