/**
 * One test call against one model (NM-29). The prompt has the same shape as
 * real features — extract structured JSON from resume-like text — so a
 * model only counts as working if it can actually do what the app asks of
 * it, not just say "OK".
 */

import { LlmModelStatus } from '../../../entities/enums'
import type { ActiveProvider } from '../providerRegistry'
import { apiUrl, FetchLike } from './providerAdapters'

export type ProbeOutcome =
  | 'ok' // correct JSON
  | 'bad_quality' // answered, but not valid / correct JSON
  | 'rate_limited' // 429, or an upstream-overloaded 5xx — retry live
  | 'unavailable' // 404 / 400 / 403-for-this-model / 422
  | 'timeout'
  | 'billing' // 402 — account-level
  | 'auth' // 401 — account-level

export interface ProbeResult {
  outcome: ProbeOutcome
  latencyMs: number
  /** Short, non-sensitive summary for logs / the catalog row. */
  detail: string
  headers?: Headers
}

const PROBE_PROMPT =
  'Extract this resume snippet into JSON with keys name (string), title (string), ' +
  'skills (array of strings), years_experience (number). Return ONLY the JSON object.\n\n' +
  'Priya Sharma — Senior Backend Engineer. 7 years building payment systems at ' +
  'Razorpay and Flipkart. Skills: Go, PostgreSQL, Kafka, Kubernetes, gRPC.'

/** True when `text` is the JSON the probe prompt asks for. */
export function isCorrectExtraction(text: string): boolean {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const candidate = cleaned.match(/\{[\s\S]*\}/)?.[0]
  if (!candidate) return false
  try {
    const j = JSON.parse(candidate) as Record<string, unknown>
    const skills = Array.isArray(j.skills) ? j.skills.map((s) => String(s).toLowerCase()) : []
    return (
      /priya/i.test(String(j.name ?? '')) &&
      Number(j.years_experience) === 7 &&
      skills.includes('go') &&
      skills.includes('postgresql')
    )
  } catch {
    return false
  }
}

/** Maps an HTTP status + parsed body to an outcome. Pure — see tests. */
export function classifyProbeResponse(status: number, body: unknown): { outcome: ProbeOutcome; detail: string } {
  // OpenRouter sometimes answers 200 with an upstream error in the body.
  const err = (body as { error?: { code?: number; message?: string } } | null)?.error
  const effective = status === 200 && err?.code ? err.code : status

  if (effective === 402) return { outcome: 'billing', detail: '402 payment required' }
  if (effective === 401) return { outcome: 'auth', detail: '401 key rejected' }
  if (effective === 429) return { outcome: 'rate_limited', detail: '429 rate limited' }
  if (effective >= 500) return { outcome: 'rate_limited', detail: `${effective} upstream error` }
  if (effective !== 200) return { outcome: 'unavailable', detail: `${effective}` }

  const text = (body as { choices?: { message?: { content?: string | null } }[] })?.choices?.[0]?.message?.content ?? ''
  if (!text) return { outcome: 'bad_quality', detail: 'empty answer' }
  return isCorrectExtraction(text) ? { outcome: 'ok', detail: 'ok' } : { outcome: 'bad_quality', detail: 'invalid JSON' }
}

export async function probeModel(
  p: ActiveProvider,
  model: string,
  opts: { timeoutMs?: number; fetchImpl?: FetchLike } = {}
): Promise<ProbeResult> {
  const { timeoutMs = 45_000, fetchImpl = fetch } = opts
  const started = Date.now()
  try {
    const res = await fetchImpl(apiUrl(p.baseUrl ?? '', 'chat/completions'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${p.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        ...(/gpt-oss/i.test(model) ? { reasoning_effort: 'low' } : {}),
        messages: [{ role: 'user', content: PROBE_PROMPT }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const body = await res.json().catch(() => null)
    return { ...classifyProbeResponse(res.status, body), latencyMs: Date.now() - started, headers: res.headers }
  } catch (err) {
    const name = (err as Error).name
    const timedOut = name === 'TimeoutError' || name === 'AbortError'
    return {
      outcome: timedOut ? 'timeout' : 'rate_limited',
      detail: timedOut ? `timeout >${Math.round(timeoutMs / 1000)}s` : `network: ${(err as Error).message}`.slice(0, 120),
      latencyMs: Date.now() - started,
    }
  }
}

/** Catalog status for a probe outcome; null = account-level, leave the model row as it was. */
export function statusForOutcome(outcome: ProbeOutcome): LlmModelStatus | null {
  switch (outcome) {
    case 'ok':
      return LlmModelStatus.ACTIVE
    case 'rate_limited':
      return LlmModelStatus.RATE_LIMITED
    case 'bad_quality':
      return LlmModelStatus.FAILED_QUALITY
    case 'unavailable':
    case 'timeout':
      return LlmModelStatus.UNAVAILABLE
    case 'billing':
    case 'auth':
      return null
  }
}
