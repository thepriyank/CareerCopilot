import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm'
import { User } from './User'

/**
 * A revocable credential for the Assisted Apply browser extension — never
 * the web app's JWT, which is short-lived and not scoped for this. Only
 * `tokenHash` (SHA-256 of the bearer value) is stored; the plaintext is
 * returned once, at mint time, and never persisted. See
 * middleware/extensionAuth.ts and docs/assisted_apply_extension_plan.md's
 * "Authentication" section.
 */
@Entity('extension_tokens')
export class ExtensionToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  userId!: string

  @ManyToOne(() => User, (u) => u.extensionTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @Column({ unique: true })
  tokenHash!: string

  // Shown in Settings' "Connected extensions" list — e.g. "Chrome on
  // MacBook". Defaults to a generic label when the caller doesn't supply one.
  @Column()
  label!: string

  @CreateDateColumn()
  createdAt!: Date

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null

  // Soft-revoke rather than delete — keeps `lastUsedAt` history visible in
  // Settings even after the user revokes it.
  @Column({ type: 'timestamp', nullable: true })
  revokedAt!: Date | null
}
