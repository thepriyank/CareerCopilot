import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToOne, OneToMany
} from 'typeorm'
import { ParseStatus } from './enums'
import { User } from './User'
import { ResumeFile } from './ResumeFile'
import { GeneratedResumeVersion } from './GeneratedResumeVersion'

@Entity('parsed_resumes')
export class ParsedResume {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.parsedResumes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ unique: true })
  sourceFileId!: string

  @OneToOne(() => ResumeFile, (rf) => rf.parsedResume)
  @JoinColumn({ name: 'sourceFileId' })
  sourceFile!: ResumeFile

  @Column({ type: 'jsonb', default: '[]' })
  sections!: unknown[]

  @Column({ type: 'jsonb', default: '{}' })
  extractedEntities!: Record<string, unknown>

  @Column({ type: 'jsonb', default: '{}' })
  confidenceScores!: Record<string, unknown>

  @Column({ type: 'text', nullable: true })
  rawText!: string | null

  @Column({ type: 'enum', enum: ParseStatus, default: ParseStatus.PROCESSING })
  status!: ParseStatus

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date

  @OneToMany(() => GeneratedResumeVersion, (grv) => grv.source)
  generatedResumes!: GeneratedResumeVersion[]
}
