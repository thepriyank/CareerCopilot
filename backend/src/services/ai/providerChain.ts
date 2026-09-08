/**
 * Per-process "which providers are currently usable" state for the LLM chain.
 *
 * When a provider fails, `generate()` classifies the failure and benches the
 * provider for a while (rate limit / quota) or for the rest of the process
 * (bad key, model doesn't exist) so subsequent calls skip straight to the next
 * one instead of re-hitting a dead endpoint on every request.
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
 * Buckets an SDK/HTTP error so the chain knows what to do with the provider:
 *  - `quota`     rate limited or out of credit  -> bench for a cooldown, retry later
 *  - `auth`      bad / missing / revoked key     -> bench for the process
 *  - `fatal`     bad request, model not found    -> bench for the process (config bug)
 *  - `transient` 5xx, network blip, timeout      -> skip for this call only
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

  if (
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
 */
export function handleProviderFailure(providerId: string, err: unknown): FailureKind {
  const kind = classifyFailure(err)
  const message = (err as Error)?.message ?? String(err)

  switch (kind) {
    case 'quota': {
      const ms = retryAfterMs(err) ?? config.llm.cooldownMs
      benchProvider(providerId, ms)
      logger.warn(`LLM provider "${providerId}" rate-limited; benched for ${Math.round(ms / 1000)}s`, {
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
    case 'fatal':
      benchProvider(providerId, Infinity)
      logger.error(`LLM provider "${providerId}" failed fatally (bad request / model unavailable); disabled for this process`, {
        err: message,
      })
      break
    case 'transient':
      logger.warn(`LLM provider "${providerId}" had a transient error; trying the next provider`, {
        err: message,
      })
      break
  }
  return kind
}

/**
 * The chain for the current call: the configured provider order with any
 * benched providers removed.
 */
export function usableChain(): ActiveProvider[] {
  return config.llm.providers.filter((p) => !isBenched(p.id))
}

/** Every configured provider, benched or not (for diagnostics / messages). */
export function fullChain(): ActiveProvider[] {
  return config.llm.providers
}

export { resolveChain }
