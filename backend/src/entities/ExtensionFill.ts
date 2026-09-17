import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm'
import { User } from './User'
import { UserJob } from './UserJob'

/**
 * One charged autofill — the quota ledger (how many a FREE user has used
 * this rolling month, see services/extension/quota.ts) and the idempotency
 * key (a repeat POST /api/extension/fills for the same normalized URL
 * within the idempotency window reuses the existing row instead of
 * charging again) in one table. See "What counts as one fill" in
 * docs/assisted_apply_extension_plan.md.
 */
@Entity('extension_fills')
@Index(['userId', 'normalizedUrl'])
export class ExtensionFill {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.extensionFills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column()
  normalizedUrl!: string

  // Null when job identification failed — filling still isn't blocked on
  // knowing which job this is, see "Job identification" in the plan doc.
  // SET NULL, not CASCADE (2026-09-17): this row is a quota-charge ledger
  // entry first — "a fill was charged on this date" stays true and worth
  // keeping even after the linked job is cleaned up (services/jobs/jobCleanup.ts);
  // only the now-invalid job reference should go, not the whole record.
  @Column({ nullable: true, type: 'uuid' })
  jobId!: string | null

  @ManyToOne(() => UserJob, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'jobId' })
  job!: UserJob | null

  @CreateDateColumn()
  createdAt!: Date
}
