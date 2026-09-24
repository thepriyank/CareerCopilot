/**
 * Owner-facing LLM alerts (NM-29): turn each provider's health into alert
 * conditions, then send them to Slack with de-duplication — a condition
 * alerts when first seen, re-alerts at most once per 24h while it persists,
 * and sends one "resolved" message when it clears.
 */

import { logger } from '../../../utils/logger'

export type ProviderState = 'ok' | 'billing' | 'auth' | 'down'

export interface ProviderHealth {
  providerId: string
  label: string
  state: ProviderState
  /** Models currently ACTIVE (passed the quality probe) for this provider. */
  workingModels: number
  /** Share of the daily allowance used (0..1), when the provider exposes it. */
  dailyUsage: number | null
  /** Short, non-sensitive detail (status codes, counts) for the message. */
  detail: string
}

export interface AlertCondition {
  key: string
  message: string
}

/** OpenRouter's free models come and go; fewer than this many working is an early warning. */
export const MIN_WORKING_MODELS: Record<string, number> = { openrouter: 3 }
const DEFAULT_MIN_WORKING = 1
export const QUOTA_ALERT_THRESHOLD = 0.8
export const REALERT_AFTER_MS = 24 * 60 * 60 * 1000

/** Which alerts should be open right now for these providers. Pure. */
export function evaluateAlerts(providers: ProviderHealth[]): AlertCondition[] {
  const out: AlertCondition[] = []
  for (const p of providers) {
    if (p.state === 'billing') {
      out.push({
        key: `billing:${p.providerId}`,
        message: `*${p.label}* needs billing action (${p.detail}). JobMagnate is skipping it until that's fixed.`,
      })
      continue
    }
    if (p.state === 'auth') {
      out.push({
        key: `key:${p.providerId}`,
        message: `*${p.label}* rejected its API key (${p.detail}). Replace the key in Secret Manager.`,
      })
      continue
    }
    if (p.state === 'down') {
      out.push({
        key: `down:${p.providerId}`,
        message: `*${p.label}* is fully down — none of its models passed the health check (${p.detail}).`,
      })
      continue
    }
    const min = MIN_WORKING_MODELS[p.providerId] ?? DEFAULT_MIN_WORKING
    if (p.workingModels < min) {
      out.push({
        key: `few-models:${p.providerId}`,
        message: `*${p.label}* has only ${p.workingModels} working free model(s) (minimum ${min}).`,
      })
    }
    if (p.dailyUsage !== null && p.dailyUsage >= QUOTA_ALERT_THRESHOLD) {
      out.push({
        key: `quota:${p.providerId}`,
        message: `*${p.label}* has used ${Math.round(p.dailyUsage * 100)}% of today's free quota. Consider topping up Ollama before it runs out.`,
      })
    }
  }
  return out
}

/** Persistence for de-dup state — the DB in production, a fake in tests. */
export interface AlertStore {
  openAlerts(): Promise<{ id: string; alertKey: string; lastSentAt: Date }[]>
  create(alertKey: string, message: string, sentAt: Date): Promise<void>
  markSent(id: string, message: string, sentAt: Date): Promise<void>
  resolve(id: string, at: Date): Promise<void>
}

export type SendFn = (text: string) => Promise<boolean>

export interface DispatchSummary {
  sent: string[]
  reminded: string[]
  resolved: string[]
  suppressed: string[]
}

/**
 * Sends new / due alerts and resolves cleared ones. Only alerts belonging to
 * `evaluatedProviderIds` can be resolved — a provider this run didn't check
 * says nothing about whether its alert cleared.
 */
export async function dispatchAlerts(
  conditions: AlertCondition[],
  evaluatedProviderIds: string[],
  store: AlertStore,
  send: SendFn,
  now: Date = new Date()
): Promise<DispatchSummary> {
  const summary: DispatchSummary = { sent: [], reminded: [], resolved: [], suppressed: [] }
  const open = await store.openAlerts()
  const openByKey = new Map(open.map((a) => [a.alertKey, a]))
  const activeKeys = new Set(conditions.map((c) => c.key))

  for (const c of conditions) {
    const existing = openByKey.get(c.key)
    if (!existing) {
      if (await send(`:rotating_light: ${c.message}`)) {
        await store.create(c.key, c.message, now)
        summary.sent.push(c.key)
      }
    } else if (now.getTime() - existing.lastSentAt.getTime() >= REALERT_AFTER_MS) {
      if (await send(`:rotating_light: Still happening: ${c.message}`)) {
        await store.markSent(existing.id, c.message, now)
        summary.reminded.push(c.key)
      }
    } else {
      summary.suppressed.push(c.key)
    }
  }

  const evaluated = new Set(evaluatedProviderIds)
  for (const a of open) {
    const providerId = a.alertKey.split(':')[1]
    if (activeKeys.has(a.alertKey) || !evaluated.has(providerId)) continue
    if (await send(`:white_check_mark: Resolved: \`${a.alertKey}\` is no longer happening.`)) {
      await store.resolve(a.id, now)
      summary.resolved.push(a.alertKey)
    }
  }
  return summary
}

/**
 * Posts to the Slack incoming webhook. Returns false (and logs) instead of
 * throwing, so a Slack outage never fails the health job — the alert simply
 * stays unsent and is retried next run. No webhook configured (staging,
 * local) → logs the text and returns false.
 */
export function slackSender(webhookUrl: string | undefined, fetchImpl: typeof fetch = fetch): SendFn {
  return async (text: string) => {
    const tagged = `[JobMagnate LLM] ${text}`
    if (!webhookUrl) {
      logger.info('LLM alert (no Slack webhook configured)', { text: tagged })
      return false
    }
    try {
      const res = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tagged }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) logger.warn('Slack alert post failed', { status: res.status })
      return res.ok
    } catch (err) {
      logger.warn('Slack alert post failed', { err: (err as Error).message })
      return false
    }
  }
}
