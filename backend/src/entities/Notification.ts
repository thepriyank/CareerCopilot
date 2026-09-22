import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm'
import { User } from './User'
import { NotificationType } from './enums'

/**
 * In-app notifications (Jira NM — pass-expiry warning is the first use).
 * `meta` carries type-specific data (e.g. `{ expiresAt }` for
 * PASS_EXPIRING) so a notifier can check "have I already told this user
 * about *this* expiry" without a separate idempotency table — see
 * services/notifications/passExpiryNotifier.ts.
 */
@Entity('notifications')
@Index(['userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType

  @Column()
  title!: string

  @Column({ type: 'text' })
  body!: string

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null

  @Column({ type: 'timestamp', nullable: true })
  readAt!: Date | null

  @CreateDateColumn()
  createdAt!: Date
}
