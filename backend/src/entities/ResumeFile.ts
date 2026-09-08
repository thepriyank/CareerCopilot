import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToOne
} from 'typeorm'
import { FileType } from './enums'
import { User } from './User'
import { ParsedResume } from './ParsedResume'

@Entity('resume_files')
export class ResumeFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.resumeFiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column()
  fileUrl!: string

  @Column({ type: 'enum', enum: FileType })
  fileType!: FileType

  @Column()
  fileName!: string

  @Column()
  fileSize!: number

  @CreateDateColumn()
  uploadedAt!: Date

  @OneToOne(() => ParsedResume, (pr) => pr.sourceFile)
  parsedResume!: ParsedResume | null
}
