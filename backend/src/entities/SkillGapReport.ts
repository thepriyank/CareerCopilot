import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToMany
} from 'typeorm'
import { User } from './User'
import { CourseRecommendation } from './CourseRecommendation'

@Entity('skill_gap_reports')
export class SkillGapReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.skillGapReports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ nullable: true, type: 'varchar' })
  roleContext!: string | null

  @Column({ nullable: true, type: 'varchar' })
  jobId!: string | null

  @Column({ type: 'jsonb', default: '[]' })
  missingSkills!: unknown[]

  // Named skills the resume already lists, and skills only supported by
  // resume prose (not a named skill) — the other two buckets of the
  // existing/supportedByResume/gap classification. `missingSkills` above is
  // the "gap" bucket. Kept as separate columns (not folded into
  // `priorityRanking`, which is unrelated) so GET /api/jobs/:id/skill-gap
  // can return the full three-bucket result, not just the gaps.
  @Column({ type: 'jsonb', default: '[]' })
  existingSkills!: unknown[]

  @Column({ type: 'jsonb', default: '[]' })
  supportedByResumeSkills!: unknown[]

  @Column({ type: 'jsonb', default: '[]' })
  priorityRanking!: unknown[]

  @CreateDateColumn()
  createdAt!: Date

  @OneToMany(() => CourseRecommendation, (cr) => cr.skillGap)
  courseRecommendations!: CourseRecommendation[]
}
