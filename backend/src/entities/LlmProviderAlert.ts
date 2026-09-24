import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

/**
 * De-dup state for one owner-facing LLM alert (NM-29). `alertKey` is stable
 * per condition (`billing:gemini`, `down:openrouter`, `quota:groq`, …): an
 * open row (resolvedAt null) means we've already told the owner; it's
 * re-sent at most once per 24h while the condition persists, and a
 * "resolved" message goes out when it clears. See catalog/alerts.ts.
 */
@Entity('llm_provider_alerts')
@Index(['alertKey', 'resolvedAt'])
export class LlmProviderAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  alertKey!: string

  @Column({ type: 'text' })
  message!: string

  @CreateDateColumn()
  firstSeenAt!: Date

  @Column({ type: 'timestamp' })
  lastSentAt!: Date

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt!: Date | null
}
