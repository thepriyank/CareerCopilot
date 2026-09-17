import { createHash } from 'crypto'
import { AppDataSource } from '../../config/dataSource'
import { FieldMappingCache } from '../../entities/FieldMappingCache'
import { generateJson } from '../ai/anthropicClient'
import { FormFieldSchema, FieldMappingEntry, PROFILE_FIELD_KEYS, isProfileFieldKey } from './fieldSchema'
import { logger } from '../../utils/logger'

// Bounds the prompt (and the cache key) — a form with more inputs than
// this is pathological, not a real application form.
const MAX_FIELDS = 100

export function hashSchema(schema: FormFieldSchema[]): string {
  const normalized = [...schema]
    .sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))
    .map((f) => `${f.fieldKey}|${f.type}|${f.label ?? ''}|${f.placeholder ?? ''}`)
    .join('\n')
  return createHash('sha256').update(normalized).digest('hex')
}

const MAPPING_PROMPT = `You are mapping a job application form's fields to a fixed set of known candidate-profile keys.

Allowed profile keys (use exactly these, or null): ${PROFILE_FIELD_KEYS.join(', ')}

Rules:
1. Map a field ONLY when you are confident it asks for that exact piece of information — judge from its label, placeholder and input type.
2. If a field doesn't clearly match one of the allowed keys (a screening question, "why do you want to work here", salary expectation, EEO/diversity question, a custom question, anything ambiguous), map it to null. Leaving a field unmapped is always safer than guessing.
3. "resume" is a file upload for the candidate's résumé/CV. "coverLetter" is a text area or file upload for a cover letter. Every other key is a short text/select value.
4. Return ONLY a JSON array, no markdown fences, one entry per field in the input, in the same order:
[{"fieldKey": "string", "profileKey": "one of the allowed keys, or null"}]

Form fields (schema only — no field values):
{FIELDS}
`

/**
 * The Tier-2 mechanism v1 ships alone (2026-09-14 — see "Field mapping" in
 * docs/assisted_apply_extension_plan.md): maps an arbitrary form's schema to
 * the known profile-key vocabulary, cached globally by `hostname +
 * schemaHash` so a given form template costs one LLM call ever, not one per
 * fill. Never sees field *values* — only name/id/type/label/placeholder.
 */
export async function mapFormSchema(hostname: string, schema: FormFieldSchema[], userId?: string): Promise<FieldMappingEntry[]> {
  const bounded = schema.slice(0, MAX_FIELDS)
  const hash = hashSchema(bounded)

  const cacheRepo = AppDataSource.getRepository(FieldMappingCache)
  const cached = await cacheRepo.findOneBy({ hostname, schemaHash: hash })
  if (cached) {
    // Best-effort telemetry — never block a cache hit on this write.
    cacheRepo.update(cached.id, { hitCount: cached.hitCount + 1 }).catch(() => {})
    return cached.mapping as unknown as FieldMappingEntry[]
  }

  const prompt = MAPPING_PROMPT.replace(
    '{FIELDS}',
    JSON.stringify(bounded.map((f) => ({ fieldKey: f.fieldKey, type: f.type, label: f.label, placeholder: f.placeholder })))
  )

  let raw: unknown
  try {
    raw = await generateJson<unknown>(prompt, { feature: 'extension_field_mapping', userId })
  } catch (err) {
    logger.error('Field mapping LLM call failed', { hostname, err: (err as Error).message })
    // Degrade to "nothing mapped" rather than blocking the fill — the
    // extension still fills whatever else it has (job/artifact data). Not
    // cached, so the next attempt on this form retries the LLM call.
    return bounded.map((f) => ({ fieldKey: f.fieldKey, profileKey: null }))
  }

  const mapping = sanitizeMapping(raw, bounded)

  const entity = cacheRepo.create({
    hostname,
    schemaHash: hash,
    mapping: mapping as unknown as Record<string, unknown>,
    hitCount: 1,
  })
  await cacheRepo.save(entity)

  return mapping
}

/** Never trusts the model's output shape — drops anything that isn't a known field mapped to a known (or null) profile key. */
function sanitizeMapping(raw: unknown, schema: FormFieldSchema[]): FieldMappingEntry[] {
  const knownFieldKeys = new Set(schema.map((f) => f.fieldKey))
  const entries = Array.isArray(raw) ? raw : []
  const byFieldKey = new Map<string, FieldMappingEntry>()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const fieldKey = (entry as Record<string, unknown>).fieldKey
    const profileKey = (entry as Record<string, unknown>).profileKey
    if (typeof fieldKey !== 'string' || !knownFieldKeys.has(fieldKey)) continue
    byFieldKey.set(fieldKey, { fieldKey, profileKey: isProfileFieldKey(profileKey) ? profileKey : null })
  }

  // One entry per input field, in input order — a field the model silently
  // dropped from its response is unmapped, not missing.
  return schema.map((f) => byFieldKey.get(f.fieldKey) ?? { fieldKey: f.fieldKey, profileKey: null })
}
