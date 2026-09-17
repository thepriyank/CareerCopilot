import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm'

/**
 * The global Tier-2 field-mapping cache — see "Field mapping" in
 * docs/assisted_apply_extension_plan.md. Keyed by `hostname + schemaHash`
 * (sha256 of the sorted form schema), never by user: the whole economics of
 * shipping Tier 2 alone depends on one distinct form template costing one
 * LLM call *ever*, across every user who ever meets that exact form.
 * `hitCount` is fill-rate-adjacent telemetry (how much reuse the cache is
 * actually getting), not load-bearing for anything else.
 */
@Entity('field_mapping_cache')
@Index(['hostname', 'schemaHash'], { unique: true })
export class FieldMappingCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  hostname!: string

  @Column()
  schemaHash!: string

  @Column({ type: 'jsonb' })
  mapping!: Record<string, unknown>

  @Column({ default: 1 })
  hitCount!: number

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
