import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { User } from './User'

@Entity('model_usage_records')
export class ModelUsageRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Null for calls with no user behind them (background jobs) — since
   * NM-29 every platform call is recorded, not only user-initiated ones. */
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null

  @ManyToOne(() => User, (u) => u.modelUsageRecords, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  user!: User | null

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
