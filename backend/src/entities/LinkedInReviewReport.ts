import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { User } from './User'

@Entity('linkedin_review_reports')
export class LinkedInReviewReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.linkedInReviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ type: 'jsonb', default: '{}' })
  sections!: Record<string, unknown>

  @Column({ type: 'jsonb', default: '{}' })
  suggestions!: Record<string, unknown>

  @Column({ type: 'int', nullable: true })
  overallScore!: number | null

  @CreateDateColumn()
  createdAt!: Date
}
