/**
 * Per-process "which providers are currently usable" state for the LLM chain.
 *
 * When a provider fails, `generate()` classifies the failure and benches the
 * provider for a while (rate limit / quota / billing / model retired) or for
 * the rest of the process (bad key) so subsequent calls skip straight to the
 * next one instead of re-hitting a dead endpoint on every request.
 *
 * State is deliberately in-memory only: a process restart re-reads the env and
 * gives every provider a fresh chance.
 */

import { config } from '../../config'
import { logger } from '../../utils/logger'
import { ActiveProvider, resolveChain } from './providerRegistry'

/** provider id -> epoch ms until which it is benched (Infinity = whole process). */
const benchedUntil = new Map<string, number>()

export function isBenched(id: string, now: number = Date.now()): boolean {
  const until = benchedUntil.get(id)
  if (until === undefined) return false
  if (until === Infinity) return true
  if (until > now) return true
  benchedUntil.delete(id)
  return false
}

/** Bench key for one model on one provider (vs. the bare provider id). */
export function modelKey(providerId: string, model: string): string {
  return `${providerId}::${model}`
}

export function benchProvider(id: string, ms: number): void {
  benchedUntil.set(id, ms === Infinity ? Infinity : Date.now() + ms)
}

/** Test seam: forget all bench state (or one provider's). */
export function resetBench(id?: string): void {
  if (id) benchedUntil.delete(id)
  else benchedUntil.clear()
}

/** Introspection for /health-style reporting. */
export function benchStatus(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, until] of benchedUntil) out[id] = until
  return out
}

export type FailureKind = 'quota' | 'auth' | 'transient' | 'fatal'

/**
 * Thrown when a provider answers 200 but with no content — e.g. a reasoning
 * model (gpt-oss) that spent its whole token budget "thinking". That's a
 * property of this one call, not of the provider, so it's classified
 * `transient` and never benches anything.
 */
export class EmptyResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmptyResponseError'
  }
}

/**
 * Buckets an SDK/HTTP error so the chain knows what to do with the provider:
 *  - `quota`     rate limited / out of credit / 402 -> bench for a cooldown, retry later
 *  - `auth`      bad / missing / revoked key         -> bench for the process
 *  - `fatal`     bad request, model not found        -> bench for `fatalCooldownMs`
 *  - `transient` 5xx, network, timeout, empty, 413   -> skip for this call only
 */
export function classifyFailure(err: unknown): FailureKind {
  const e = err as {
    status?: number
    response?: { status?: number }
    code?: string
    name?: string
    message?: string
    error?: { message?: string; type?: string }
  }
  const status = e?.status ?? e?.response?.status
  const code = String(e?.code ?? '')
  const name = String(e?.name ?? '')
  const msg = `${e?.message ?? ''} ${e?.error?.message ?? ''} ${e?.error?.type ?? ''}`.toLowerCase()

  if (name === 'EmptyResponseError') return 'transient'
  // 413: this request is bigger than the provider's per-minute token budget
  // (Groq free tier: 8K TPM on gpt-oss). A smaller call would succeed, so it's
  // not the provider's fault — skip it for this call only, don't bench.
  if (status === 413) return 'transient'

  if (
    status === 402 ||
    status === 429 ||
    /rate.?limit|quota|exceed(ed)?|insufficient|balance|billing|credits?\b|out of (credit|quota)|too many requests/.test(
      msg
    )
  ) {
    return 'quota'
  }
  if (
    status === 401 ||
    status === 403 ||
    /unauthorized|invalid.*(api.?key|x-api-key|token)|permission denied|forbidden|authentication/.test(msg)
  ) {
    return 'auth'
  }
  if (
    (status !== undefined && status >= 500) ||
    /econnreset|etimedout|enotfound|eai_again|socket hang up|network error|timed? ?out|fetch failed/i.test(
      `${code} ${name} ${msg}`
    ) ||
    name === 'APIConnectionError' ||
    name === 'APIConnectionTimeoutError'
  ) {
    return 'transient'
  }
  // 400, 404 "model not found" / "no endpoints" / "unavailable for free", etc.
  return 'fatal'
}

/** Honors a `Retry-After` (seconds or HTTP-date) header if the SDK surfaced one. */
export function retryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: unknown; response?: { headers?: unknown } })?.headers
    ?? (err as { response?: { headers?: unknown } })?.response?.headers
  if (!headers) return null
  const get = (k: string): string | undefined => {
    const h = headers as Record<string, string> & { get?: (k: string) => string | null }
    if (typeof h.get === 'function') return h.get(k) ?? undefined
    return h[k] ?? h[k.toLowerCase()]
  }
  const raw = get('retry-after')
  if (!raw) return null
  const secs = Number(raw)
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000)
  const when = Date.parse(raw)
  return Number.isNaN(when) ? null : Math.max(0, when - Date.now())
}

/**
 * Applies the bench policy for a classified failure and logs it. Returns the
 * failure kind so the caller can decide whether to keep a "last error".
 *
 * With `model` given, rate limits and "model retired" bench only that model
 * (OpenRouter's free models are each throttled upstream, so the provider's
 * next model still gets a chance). Billing (402) and bad keys are
 * account-wide, so those always bench the whole provider.
 */
export function handleProviderFailure(providerId: string, err: unknown, model?: string): FailureKind {
  const kind = classifyFailure(err)
  const message = (err as Error)?.message ?? String(err)
  const isBilling = (err as { status?: number })?.status === 402
  const perModel = model !== undefined && (kind === 'fatal' || (kind === 'quota' && !isBilling))
  const benchId = perModel ? modelKey(providerId, model) : providerId
  const label = perModel ? `${providerId}" model "${model}` : providerId

  switch (kind) {
    case 'quota': {
      // A 402 means "go fix billing" — no point re-trying every 15 minutes.
      const ms = retryAfterMs(err) ?? (isBilling ? config.llm.billingCooldownMs : config.llm.cooldownMs)
      benchProvider(benchId, ms)
      logger.warn(`LLM provider "${label}" rate-limited; benched for ${Math.round(ms / 1000)}s`, {
        err: message,
      })
      break
    }
    case 'auth':
      benchProvider(providerId, Infinity)
      logger.error(`LLM provider "${providerId}" rejected its API key; disabled for this process`, {
        err: message,
      })
      break
    case 'fatal': {
      // Bounded, not Infinity: a single bad response (or a model retired
      // mid-deploy) used to take the provider out until the next restart.
      const ms = config.llm.fatalCooldownMs
      benchProvider(benchId, ms)
      logger.error(
        `LLM provider "${label}" failed fatally (bad request / model unavailable); benched for ${Math.round(ms / 60_000)}min`,
        { err: message }
      )
      break
    }
    case 'transient':
      logger.warn(`LLM provider "${label}" had a transient error; trying the next option`, {
        err: message,
      })
      break
  }
  return kind
}

/** A provider's models in order, minus any benched individually. */
export function usableModels(p: ActiveProvider): string[] {
  const models = p.models?.length ? p.models : [p.model]
  return models.filter((m) => !isBenched(modelKey(p.id, m)))
}

/**
 * The chain for the current call: the configured provider order with any
 * benched providers — or providers whose every model is benched — removed.
 */
export function usableChain(): ActiveProvider[] {
  return config.llm.providers.filter((p) => !isBenched(p.id) && usableModels(p).length > 0)
}

/** Every configured provider, benched or not (for diagnostics / messages). */
export function fullChain(): ActiveProvider[] {
  return config.llm.providers
}

export { resolveChain }
