import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'
import { LlmModelStatus } from './enums'

/**
 * One model on one platform LLM provider, as last seen by the weekly catalog
 * refresh / daily health check (NM-29, docs/NM-29_plan.md). The web service
 * reads ACTIVE + RATE_LIMITED rows by `rank` to decide which models to try
 * (services/ai/catalog/modelCatalog.ts), falling back to the hardcoded
 * registry defaults when this table is empty (e.g. staging).
 */
@Entity('llm_model_catalog')
@Index(['providerId', 'modelId'], { unique: true })
export class LlmModelCatalogEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  providerId!: string

  @Column()
  modelId!: string

  @Column({ type: 'enum', enum: LlmModelStatus })
  status!: LlmModelStatus

  /** Lower is tried first. Only meaningful among ACTIVE / RATE_LIMITED rows. */
  @Column('int', { default: 1000 })
  rank!: number

  @Column('boolean', { default: true })
  isFree!: boolean

  @Column('boolean', { default: false })
  isReasoning!: boolean

  @Column('int', { nullable: true })
  contextWindow!: number | null

  @Column('int', { nullable: true })
  maxOutputTokens!: number | null

  @Column({ type: 'timestamp', nullable: true })
  lastSeenAt!: Date | null

  @Column({ type: 'timestamp', nullable: true })
  lastProbeAt!: Date | null

  /** Short, non-sensitive summary, e.g. "ok", "429", "invalid JSON". */
  @Column({ type: 'varchar', nullable: true })
  lastProbeResult!: string | null

  @Column('int', { nullable: true })
  lastProbeLatencyMs!: number | null

  @Column('int', { default: 0 })
  consecutiveFailures!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
