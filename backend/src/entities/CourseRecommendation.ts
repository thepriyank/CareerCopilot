import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { User } from './User'
import { SkillGapReport } from './SkillGapReport'

@Entity('course_recommendations')
export class CourseRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.courseRecommendations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column()
  skillGapId!: string

  @ManyToOne(() => SkillGapReport, (sg) => sg.courseRecommendations)
  @JoinColumn({ name: 'skillGapId' })
  skillGap!: SkillGapReport

  @Column()
  provider!: string

  @Column()
  title!: string

  @Column()
  url!: string

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>

  @CreateDateColumn()
  createdAt!: Date
}
