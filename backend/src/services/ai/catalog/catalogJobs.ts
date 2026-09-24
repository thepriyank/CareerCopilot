/**
 * The two NM-29 jobs (see docs/NM-29_plan.md):
 *
 * - refreshCatalog()  — weekly: list every free provider's models, probe the
 *   chat-capable ones, upsert the catalog, retire vanished models, re-rank.
 * - runHealthCheck()  — daily: probe each provider's top-ranked models until
 *   one passes (max 3), update those rows, re-rank.
 *
 * Both finish by turning per-provider health into Slack alerts (alerts.ts).
 * Only free, OpenAI-protocol providers are managed; paid providers and the
 * user's own connections are out of scope.
 */

import { IsNull } from 'typeorm'
import { AppDataSource } from '../../../config/dataSource'
import { LlmModelCatalogEntry } from '../../../entities/LlmModelCatalogEntry'
import { LlmProviderAlert } from '../../../entities/LlmProviderAlert'
import { LlmModelStatus } from '../../../entities/enums'
import { logger } from '../../../utils/logger'
import { ActiveProvider, PROVIDER_REGISTRY, resolveChain } from '../providerRegistry'
import { AlertStore, dispatchAlerts, evaluateAlerts, ProviderHealth, ProviderState, slackSender } from './alerts'
import { USABLE_STATUSES } from './modelCatalog'
import { ProbeResult, probeModel, statusForOutcome } from './probe'
import { groqDailyUsage, isCandidateModel, listModels, openRouterKeyUsage } from './providerAdapters'

const MAX_PROBES_PER_PROVIDER = 20
/**
 * How hard the weekly refresh may hit each provider. Gemini's free tier
 * allows ~15 requests/minute, so probing 3 at once rate-limited 12 of 20
 * models in the first real run — one at a time, ~4.5s apart, stays under it.
 */
const PROBE_PACING: Record<string, { concurrency: number; gapMs: number }> = {
  gemini: { concurrency: 1, gapMs: 4500 },
}
const DEFAULT_PACING = { concurrency: 3, gapMs: 0 }
/** Parameter count below which a model is only a last resort, e.g. "allam-2-7b". */
const SMALL_MODEL_B = 20
const HEALTH_PROBES_PER_PROVIDER = 3
const UNRANKED = 1000

type Row = LlmModelCatalogEntry

/** The registry's hand-picked models for a provider (default + fallbacks), in order. */
function curatedModels(p: ActiveProvider): string[] {
  const def = PROVIDER_REGISTRY.find((d) => d.id === p.id)
  return def ? [def.defaultModel, ...(def.fallbackModels ?? [])] : []
}

export function managedProviders(env: NodeJS.ProcessEnv = process.env): ActiveProvider[] {
  return resolveChain(env).filter((p) => p.tier === 'free' && p.protocol === 'openai')
}

/** Parses a parameter count like "7b" / "30b" / "120b" out of a model id; null if absent. */
export function paramBillions(modelId: string): number | null {
  const all = [...modelId.toLowerCase().matchAll(/(\d+(?:\.\d+)?)b(?![a-z])/g)].map((m) => Number(m[1]))
  return all.length ? Math.max(...all) : null
}

/**
 * Order the live chain tries models in. Speed alone is the wrong signal —
 * in the first real run Groq's fastest passing model was allam-2-7b, which
 * would have pulled all traffic off gpt-oss-120b. So, within ACTIVE and then
 * within RATE_LIMITED:
 *   1. the registry's curated models (`preferred`, in their curated order),
 *   2. other models, fastest first,
 *   3. small models (< SMALL_MODEL_B params) last, fastest first.
 * Everything else is unranked (never tried live).
 */
export function rankRows(
  rows: Pick<Row, 'modelId' | 'status' | 'lastProbeLatencyMs' | 'rank'>[],
  preferred: string[] = []
): void {
  const tier = (r: Pick<Row, 'modelId'>) => {
    if (preferred.includes(r.modelId)) return 0
    const b = paramBillions(r.modelId)
    return b !== null && b < SMALL_MODEL_B ? 2 : 1
  }
  const order = (a: Pick<Row, 'modelId' | 'lastProbeLatencyMs'>, b: Pick<Row, 'modelId' | 'lastProbeLatencyMs'>) =>
    tier(a) - tier(b) ||
    (tier(a) === 0 ? preferred.indexOf(a.modelId) - preferred.indexOf(b.modelId) : 0) ||
    (a.lastProbeLatencyMs ?? Infinity) - (b.lastProbeLatencyMs ?? Infinity)
  const active = rows.filter((r) => r.status === LlmModelStatus.ACTIVE).sort(order)
  const limited = rows.filter((r) => r.status === LlmModelStatus.RATE_LIMITED).sort(order)
  let rank = 1
  for (const r of [...active, ...limited]) r.rank = rank++
  for (const r of rows) if (!USABLE_STATUSES.includes(r.status)) r.rank = UNRANKED
}

/**
 * 402 / 401 mean the whole account needs attention — but only when nothing
 * else on the provider works. Ollama answers 402 for its premium models
 * while the free ones pass; that's "this model needs a paid plan", not
 * "your account needs billing" (a false alert in the first real run).
 */
export function accountState(results: Pick<ProbeResult, 'outcome'>[]): ProviderState | null {
  if (results.some((r) => r.outcome === 'ok')) return null
  if (results.some((r) => r.outcome === 'billing')) return 'billing'
  if (results.some((r) => r.outcome === 'auth')) return 'auth'
  return null
}

function applyProbe(row: Row, result: ProbeResult, at: Date, accountLevel: boolean): void {
  // Account-level 402/401 says nothing about the model itself — leave the row.
  // Per-model 402 (the provider works, this model is paywalled) → UNAVAILABLE.
  const status = statusForOutcome(result.outcome) ?? (accountLevel ? null : LlmModelStatus.UNAVAILABLE)
  if (status === null) return
  row.status = status
  row.lastProbeAt = at
  row.lastProbeResult = result.detail
  row.lastProbeLatencyMs = result.outcome === 'ok' ? result.latencyMs : null
  row.consecutiveFailures = result.outcome === 'ok' ? 0 : row.consecutiveFailures + 1
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>, gapMs = 0): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      if (gapMs && i > 0) await new Promise((r) => setTimeout(r, gapMs))
      out[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

async function dailyUsageFor(p: ActiveProvider, results: ProbeResult[]): Promise<number | null> {
  if (p.id === 'groq') {
    const withHeaders = [...results].reverse().find((r) => r.headers?.get('x-ratelimit-limit-requests'))
    return groqDailyUsage(withHeaders?.headers)
  }
  if (p.id === 'openrouter') return openRouterKeyUsage(p)
  return null
}

function healthFrom(p: ActiveProvider, rows: Row[], results: ProbeResult[], dailyUsage: number | null): ProviderHealth {
  const ok = results.filter((r) => r.outcome === 'ok').length
  const limited = results.filter((r) => r.outcome === 'rate_limited').length
  const working = rows.length ? rows.filter((r) => r.status === LlmModelStatus.ACTIVE).length : ok
  // "Down" = nothing answered usefully. Rate-limited answers still mean the
  // provider is up (free tiers 429 constantly) — that's "few models", not down.
  const state = accountState(results) ?? (ok === 0 && limited === 0 && results.length > 0 ? 'down' : 'ok')
  return {
    providerId: p.id,
    label: p.label,
    state,
    workingModels: working,
    dailyUsage,
    detail: `${ok}/${results.length} probed model(s) passed`,
  }
}

export async function refreshCatalog(): Promise<ProviderHealth[]> {
  const repo = AppDataSource.getRepository(LlmModelCatalogEntry)
  const reports: ProviderHealth[] = []

  for (const p of managedProviders()) {
    const now = new Date()
    const existing = await repo.find({ where: { providerId: p.id } })
    const byId = new Map(existing.map((r) => [r.modelId, r]))

    const listed = await listModels(p)
    if (!listed.ok) {
      const state: ProviderState = listed.status === 402 ? 'billing' : listed.status === 401 ? 'auth' : 'down'
      reports.push({ providerId: p.id, label: p.label, state, workingModels: 0, dailyUsage: null, detail: `model list failed (${listed.status || 'network'})` })
      logger.warn(`catalog refresh: ${p.id} model list failed`, { status: listed.status })
      continue
    }

    const candidates = listed.models.filter((m) => isCandidateModel(p.id, m.id))
    // Probe budget goes to known-good models first, then never-seen ones.
    const priority = (id: string) => {
      const r = byId.get(id)
      if (!r) return 1
      return r.status === LlmModelStatus.ACTIVE ? 0 : r.status === LlmModelStatus.RATE_LIMITED ? 1 : 2
    }
    const toProbe = [...candidates]
      .sort((a, b) => priority(a.id) - priority(b.id) || (byId.get(a.id)?.rank ?? UNRANKED) - (byId.get(b.id)?.rank ?? UNRANKED))
      .slice(0, MAX_PROBES_PER_PROVIDER)
    const pacing = PROBE_PACING[p.id] ?? DEFAULT_PACING
    const results = await mapLimit(toProbe, pacing.concurrency, (m) => probeModel(p, m.id), pacing.gapMs)
    const resultById = new Map(toProbe.map((m, i) => [m.id, results[i]]))
    const accountLevel = accountState(results) !== null

    const rows: Row[] = []
    for (const m of candidates) {
      const row =
        byId.get(m.id) ??
        repo.create({
          providerId: p.id,
          modelId: m.id,
          status: LlmModelStatus.UNAVAILABLE,
          lastProbeResult: 'not probed yet',
          consecutiveFailures: 0,
          rank: UNRANKED,
        })
      row.lastSeenAt = now
      row.isFree = m.isFree
      row.isReasoning = /gpt-oss|reason|think/i.test(m.id)
      row.contextWindow = m.contextWindow
      row.maxOutputTokens = m.maxOutputTokens
      const result = resultById.get(m.id)
      if (result) applyProbe(row, result, now, accountLevel)
      rows.push(row)
    }
    const listedIds = new Set(candidates.map((m) => m.id))
    for (const r of existing) {
      if (listedIds.has(r.modelId)) continue
      r.status = LlmModelStatus.RETIRED
      rows.push(r)
    }
    rankRows(rows, curatedModels(p))
    await repo.save(rows)

    const health = healthFrom(p, rows, results, await dailyUsageFor(p, results))
    reports.push(health)
    logger.info(`catalog refresh: ${p.id} — ${candidates.length} listed, ${toProbe.length} probed, ${health.workingModels} working`, {
      state: health.state,
    })
  }

  await alertOn(reports)
  return reports
}

export async function runHealthCheck(): Promise<ProviderHealth[]> {
  const repo = AppDataSource.getRepository(LlmModelCatalogEntry)
  const reports: ProviderHealth[] = []

  for (const p of managedProviders()) {
    const now = new Date()
    const rows = await repo.find({ where: { providerId: p.id }, order: { rank: 'ASC' } })
    const usable = rows.filter((r) => USABLE_STATUSES.includes(r.status))
    // Before the first weekly refresh the catalog is empty — check the
    // registry's hardcoded models so the daily alert still works.
    const models = usable.length ? usable.map((r) => r.modelId) : p.models

    const results: ProbeResult[] = []
    for (const model of models.slice(0, HEALTH_PROBES_PER_PROVIDER)) {
      const result = await probeModel(p, model)
      results.push(result)
      const row = rows.find((r) => r.modelId === model)
      // A lone 402 here can't tell "account" from "this model" apart; the
      // weekly refresh (which sees every model) settles per-model status.
      if (row) applyProbe(row, result, now, true)
      if (result.outcome === 'ok') break
    }
    if (rows.length) {
      rankRows(rows, curatedModels(p))
      await repo.save(rows)
    }

    const health = healthFrom(p, rows, results, await dailyUsageFor(p, results))
    reports.push(health)
    logger.info(`health check: ${p.id} — ${health.detail}`, { state: health.state, working: health.workingModels })
  }

  await alertOn(reports)
  return reports
}

async function alertOn(reports: ProviderHealth[]): Promise<void> {
  const conditions = evaluateAlerts(reports)
  const summary = await dispatchAlerts(
    conditions,
    reports.map((r) => r.providerId),
    dbAlertStore(),
    slackSender(process.env.SLACK_ALERTS_WEBHOOK_URL)
  )
  logger.info('LLM alerts', { conditions: conditions.map((c) => c.key), ...summary })
}

export function dbAlertStore(): AlertStore {
  const repo = AppDataSource.getRepository(LlmProviderAlert)
  return {
    openAlerts: () => repo.find({ where: { resolvedAt: IsNull() } }),
    create: async (alertKey, message, sentAt) => {
      await repo.save(repo.create({ alertKey, message, lastSentAt: sentAt, resolvedAt: null }))
    },
    markSent: async (id, message, sentAt) => {
      await repo.update({ id }, { message, lastSentAt: sentAt })
    },
    resolve: async (id, at) => {
      await repo.update({ id }, { resolvedAt: at })
    },
  }
}
