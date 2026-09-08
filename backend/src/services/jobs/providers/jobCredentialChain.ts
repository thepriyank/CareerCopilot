/**
 * Per-credential bench/rotation helper for job-aggregator providers that hold
 * MULTIPLE keys pointing at the same underlying data source — e.g. JSearch is
 * offered both directly by OpenWeb Ninja (`api.openwebninja.com`) and via the
 * RapidAPI marketplace (`jsearch.p.rapidapi.com`): same company, same
 * Google-for-Jobs data, two independent free-tier monthly quotas.
 *
 * Only ONE credential is ever used per logical search call — querying both
 * for the same term would return the same jobs twice (burning both quotas
 * for zero new coverage), so this tries credentials in order and only moves
 * to the next once the current one is confirmed exhausted, mirroring the LLM
 * provider chain's bench pattern (services/ai/providerChain.ts) but with
 * monthly-quota semantics instead of a short rate-limit cooldown: free job
 * APIs bill by the calendar month, so retrying sooner than next month is
 * pointless.
 *
 * State is in-memory only (same documented tradeoff as the LLM chain) — a
 * process restart re-reads env and gives every credential a fresh chance,
 * which costs one wasted attempt before falling through, not a real failure.
 */

const benchedUntil = new Map<string, number>()

export function isBenched(id: string, now: number = Date.now()): boolean {
  const until = benchedUntil.get(id)
  if (until === undefined) return false
  if (until > now) return true
  benchedUntil.delete(id)
  return false
}

/** Test seam: forget all bench state (or one credential's). */
export function resetBench(id?: string): void {
  if (id) benchedUntil.delete(id)
  else benchedUntil.clear()
}

/** Introspection — e.g. for a future /health-style report of which credentials are exhausted. */
export function benchStatus(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, until] of benchedUntil) out[id] = until
  return out
}

function startOfNextMonthUtc(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
}

export type JobApiFailureKind = 'quota' | 'auth' | 'transient' | 'fatal'

/**
 * Buckets an HTTP/SDK error the same way services/ai/providerChain.ts does
 * for LLM providers, but kept as an independent implementation — job APIs
 * live in a different domain and monthly-quota bench duration differs enough
 * (see handleJobApiFailure) that sharing the AI-domain function would be a
 * more confusing cross-import than the small duplication here.
 */
export function classifyJobApiFailure(err: unknown): JobApiFailureKind {
  const e = err as { status?: number; message?: string; body?: string }
  const status = e?.status
  const msg = `${e?.message ?? ''} ${e?.body ?? ''}`.toLowerCase()

  if (status === 429 || /quota|rate.?limit|exceed(ed)?|too many requests/.test(msg)) return 'quota'
  if (status === 401 || status === 403 || /unauthorized|invalid.*api.?key|forbidden/.test(msg)) return 'auth'
  if ((status !== undefined && status >= 500) || /timed? ?out|network|econnreset|enotfound|eai_again/.test(msg)) {
    return 'transient'
  }
  return 'fatal'
}

/**
 * Applies the bench policy for a classified failure. Quota, auth (bad/revoked
 * key), and fatal (e.g. account suspended) all bench until next month — none
 * of them fix themselves sooner. Transient (network blip, 5xx) doesn't bench
 * at all, so the very next call gets a fresh try.
 */
export function handleJobApiFailure(credentialId: string, err: unknown): JobApiFailureKind {
  const kind = classifyJobApiFailure(err)
  if (kind !== 'transient') {
    benchedUntil.set(credentialId, startOfNextMonthUtc())
  }
  return kind
}

/** The usable subset of a credential list, in order, skipping anything currently benched. */
export function usableCredentials<T extends { id: string }>(all: T[]): T[] {
  return all.filter((c) => !isBenched(c.id))
}
