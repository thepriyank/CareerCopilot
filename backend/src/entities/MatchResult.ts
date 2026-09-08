import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { User } from './User'
import { UserJob } from './UserJob'

@Entity('match_results')
export class MatchResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.matchResults, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  // Points at a UserJob row, not a JobListing — a match score is scoped to
  // one user's résumé against one job, and UserJob already resolves to
  // exactly one user (see UserJob.ts's doc comment).
  @Column()
  jobId!: string

  @ManyToOne(() => UserJob, (uj) => uj.matchResults, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job!: UserJob

  @Column('float')
  score!: number

  @Column({ type: 'jsonb', default: '{}' })
  rationale!: Record<string, unknown>

  @Column({ type: 'jsonb', default: '[]' })
  gaps!: unknown[]

  @CreateDateColumn()
  createdAt!: Date
}
