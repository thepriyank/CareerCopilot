import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { User } from './User'

@Entity('model_usage_records')
export class ModelUsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.modelUsageRecords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column()
  modelName!: string

  @Column()
  apiKeySource!: string

  @Column('int')
  tokensUsed!: number

  @Column('float', { nullable: true })
  costEstimate!: number | null

  @Column({ nullable: true, type: 'varchar' })
  feature!: string | null

  @CreateDateColumn()
  createdAt!: Date
}
