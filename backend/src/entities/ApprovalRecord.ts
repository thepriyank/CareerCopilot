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

  @Column({ nullable: true, type: 'uuid' })
  resumeVersionId!: string | null

  @ManyToOne(() => GeneratedResumeVersion, (grv) => grv.approvalRecords, { nullable: true })
  @JoinColumn({ name: 'resumeVersionId' })
  resumeVersion!: GeneratedResumeVersion | null

  @Column({ nullable: true, type: 'uuid' })
  coverLetterId!: string | null

  @ManyToOne(() => GeneratedCoverLetter, (gcl) => gcl.approvalRecords, { nullable: true })
  @JoinColumn({ name: 'coverLetterId' })
  coverLetter!: GeneratedCoverLetter | null
}
