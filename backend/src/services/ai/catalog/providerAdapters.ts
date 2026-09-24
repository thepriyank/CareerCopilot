/**
 * Per-provider model listing, chat-model filtering and quota reading for the
 * NM-29 catalog jobs. Plain `fetch` against each provider's OpenAI-compatible
 * API (no SDK) so the jobs see raw status codes and headers.
 */

import type { ActiveProvider } from '../providerRegistry'

export interface ListedModel {
  id: string
  isFree: boolean
  contextWindow: number | null
  maxOutputTokens: number | null
}

export type ListResult =
  | { ok: true; models: ListedModel[] }
  | { ok: false; status: number; detail: string }

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Anything that isn't a general text-chat model: speech, image/video/music
 * generation, embeddings, realtime/audio, safety classifiers, agent-only or
 * domain-specialist variants. Probing these would only burn free quota.
 */
const NON_CHAT =
  /(tts|speech|whisper|transcri|image|imagen|veo|lyria|nano-banana|embed|\baqa\b|live|native-audio|audio|robotics|computer-use|deep-research|antigravity|prompt-guard|safeguard|content-safety|guard|playai|orpheus|-code\b|coder|-fin\b|-sante\b)/i

export function isCandidateModel(providerId: string, modelId: string): boolean {
  if (NON_CHAT.test(modelId)) return false
  // OpenRouter lists hundreds of paid models; only its `:free` variants cost
  // nothing, and those are the only ones this catalog manages.
  if (providerId === 'openrouter') return modelId.endsWith(':free')
  return true
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export async function listModels(p: ActiveProvider, fetchImpl: FetchLike = fetch): Promise<ListResult> {
  let res: Response
  try {
    res = await fetchImpl(apiUrl(p.baseUrl ?? '', 'models'), {
      headers: { Authorization: `Bearer ${p.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    return { ok: false, status: 0, detail: `network: ${(err as Error).message}` }
  }
  if (!res.ok) return { ok: false, status: res.status, detail: (await res.text().catch(() => '')).slice(0, 200) }

  const body = (await res.json().catch(() => null)) as { data?: Record<string, unknown>[] } | null
  const models: ListedModel[] = []
  for (const m of body?.data ?? []) {
    const rawId = String(m.id ?? '')
    const id = rawId.replace(/^models\//, '') // Gemini's OpenAI-compat list prefixes "models/"
    if (!id) continue
    const top = (m.top_provider ?? {}) as Record<string, unknown>
    models.push({
      id,
      isFree: p.id === 'openrouter' ? id.endsWith(':free') : true,
      contextWindow: num(m.context_window) ?? num(m.context_length),
      maxOutputTokens: num(m.max_completion_tokens) ?? num(top.max_completion_tokens),
    })
  }
  return { ok: true, models }
}

/**
 * Share of a provider's *daily* allowance used, 0..1, or null when the
 * provider doesn't expose one.
 *
 * - Groq: `x-ratelimit-limit-requests` / `-remaining-requests` on any chat
 *   response are requests-per-day (its token headers are per minute, so
 *   they're not a daily quota and are ignored here).
 * - OpenRouter: `GET /api/v1/key` — usage vs. the key's credit limit, when
 *   one is set. Its per-day cap on `:free` models isn't exposed; running out
 *   shows up as 429s in the probes instead.
 * - Gemini, Ollama: no quota API — covered by probe outcomes (429 / 402).
 */
export function groqDailyUsage(headers: Headers | undefined): number | null {
  const limit = Number(headers?.get('x-ratelimit-limit-requests'))
  const remaining = Number(headers?.get('x-ratelimit-remaining-requests'))
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) return null
  return Math.min(1, Math.max(0, 1 - remaining / limit))
}

export async function openRouterKeyUsage(p: ActiveProvider, fetchImpl: FetchLike = fetch): Promise<number | null> {
  try {
    const res = await fetchImpl(apiUrl(p.baseUrl ?? '', 'key'), {
      headers: { Authorization: `Bearer ${p.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return null
    const d = ((await res.json()) as { data?: { limit?: number | null; usage?: number } }).data
    if (!d || typeof d.limit !== 'number' || d.limit <= 0 || typeof d.usage !== 'number') return null
    return Math.min(1, d.usage / d.limit)
  } catch {
    return null
  }
}
