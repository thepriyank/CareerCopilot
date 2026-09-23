/**
 * The platform LLM provider chain.
 *
 * `generate()` (in anthropicClient.ts) walks an ordered list of providers and
 * uses the first one that answers. Every free-tier provider is tried before any
 * paid one; when a provider hits its rate limit / quota the caller benches it
 * (see providerChain.ts) and moves to the next.
 *
 * A provider is *active* only when its API-key env var is set. That's the whole
 * configuration surface for adding a new free tier: drop its key in `.env` and,
 * if it isn't already in `PROVIDER_REGISTRY` below, add one line here.
 *
 * All providers except Anthropic are called over the OpenAI-compatible
 * chat-completions wire protocol, so they share one client path.
 */

export type ProviderTier = 'free' | 'paid'
export type WireProtocol = 'openai' | 'anthropic'

export interface ProviderDef {
  id: string
  label: string
  tier: ProviderTier
  protocol: WireProtocol
  /** OpenAI-compatible base URL. Omitted for the native Anthropic protocol. */
  baseUrl?: string
  /** Env var that holds this provider's API key; presence = provider is active. */
  apiKeyEnv: string
  /** Accepted misspellings / older names for `apiKeyEnv` (e.g. GROK_API_KEY for Groq). */
  apiKeyEnvAliases?: string[]
  /** Env var that overrides the model list — one id, or a comma-separated
   * list tried in order (e.g. `OPENROUTER_MODEL=a:free,b:free`). */
  modelEnv?: string
  /** Model used when `modelEnv` is unset. */
  defaultModel: string
  /** Tried in order after `defaultModel` when it's rate-limited / retired —
   * see runPlatformChain. Only used when `modelEnv` is unset. */
  fallbackModels?: string[]
}

/**
 * Known providers, in their natural default priority. `LLM_PROVIDER_ORDER` can
 * reorder them; free-before-paid is always enforced afterwards regardless.
 *
 * Free-tier defaults are picked to be broadly available on a new key with no
 * billing set up. Model ids drift — override with the `*_MODEL` env var if a
 * default has been retired.
 */
export const PROVIDER_REGISTRY: ProviderDef[] = [
  {
    id: 'groq',
    label: 'Groq',
    tier: 'free',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKeyEnv: 'GROQ_API_KEY',
    apiKeyEnvAliases: ['GROK_API_KEY'], // Groq keys are gsk_… ; "Grok" is a common mixup
    modelEnv: 'GROQ_MODEL',
    // Free tier (2026-09-23): 30 RPM, 1K RPD, 8K TPM, 200K TPD — same for
    // 20b and 120b, so take the stronger one.
    defaultModel: 'openai/gpt-oss-120b',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    tier: 'free',
    protocol: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    modelEnv: 'CEREBRAS_MODEL',
    defaultModel: 'gpt-oss-120b',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    tier: 'free',
    protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GEMINI_API_KEY',
    modelEnv: 'GEMINI_MODEL',
    defaultModel: 'gemini-3.5-flash-lite', // 2.5 retired for new users (404), verified 2026-09-23
  },
  {
    id: 'ollama',
    label: 'Ollama Cloud',
    tier: 'free',
    protocol: 'openai',
    baseUrl: 'https://ollama.com/v1',
    apiKeyEnv: 'OLLAMA_API_KEY',
    modelEnv: 'OLLAMA_MODEL',
    defaultModel: 'gpt-oss:20b',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    tier: 'free',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    // Free models are individually rate-limited upstream (most 429 at any
    // given moment), so a list matters far more here than anywhere else.
    // Probed 2026-09-23 with a JSON-extraction prompt: the first seven
    // answered correctly (fastest-good first); the last five were 429ing at
    // the time but are solid general models. Excluded: inkling/inkling-small
    // (403, agentic harnesses only), nex-n2.5-pro and nemotron-3.5-lightning
    // (23s / 95s), the specialist ones (content-safety, code, fin, sante)
    // and lfm-2.5-2.6b (too small). NM-29 replaces this hand-kept list with
    // a DB catalog refreshed weekly.
    defaultModel: 'nvidia/nemotron-3-super-120b-a12b:free',
    fallbackModels: [
      'nex-agi/nex-n2.5-mini:free',
      'inclusionai/ling-3.0-flash-vl:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'dots-studio/dots-3-note-preview:free',
      'poolside/laguna-xs-2.1:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-31b-it:free',
      'qwen/qwen3.8-27b:free',
      'z-ai/glm-5.2:free',
      'google/gemma-4-26b-a4b-it:free',
      'poolside/laguna-s-2.1:free',
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    tier: 'paid', // very cheap, but no free tier — needs LLM_ALLOW_PAID
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    modelEnv: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    tier: 'paid',
    protocol: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
    defaultModel: 'claude-haiku-4-5-20251001',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    tier: 'paid',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
  },
]

export interface ActiveProvider {
  id: string
  label: string
  tier: ProviderTier
  protocol: WireProtocol
  baseUrl?: string
  apiKey: string
  /** The model this call uses — `models[0]` from resolveChain; runPlatformChain
   * passes a copy with the specific fallback model it's trying. */
  model: string
  /** Every model to try on this provider, in order. */
  models: string[]
}

// Ollama sits last among the free tier on purpose: it's the account we top
// up with paid credit when free quotas run dry (decided 2026-09-23), so it's
// the backstop for the genuinely-free providers and is always reached before
// any `paid`-tier provider (DeepSeek / Anthropic / OpenAI, LLM_ALLOW_PAID).
const DEFAULT_ORDER = 'groq,cerebras,gemini,openrouter,ollama,deepseek,anthropic,openai'

function truthy(v: string | undefined): boolean {
  return v !== undefined && /^(1|true|yes|on)$/i.test(v.trim())
}

/**
 * Resolves the ordered, ready-to-call provider chain from environment.
 *
 * Rules:
 *  - a provider is included only if its `apiKeyEnv` is set and non-empty;
 *  - `LLM_PROVIDER_ORDER` (csv of provider ids) sets priority; anything not
 *    listed there falls to the end in registry order;
 *  - all `free` providers come before any `paid` provider, always;
 *  - `paid` providers are dropped entirely unless `LLM_ALLOW_PAID` is truthy.
 *
 * `env` is injectable for testing; it defaults to `process.env`.
 */
export function resolveChain(env: NodeJS.ProcessEnv = process.env): ActiveProvider[] {
  const order = (env.LLM_PROVIDER_ORDER ?? DEFAULT_ORDER)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const allowPaid = truthy(env.LLM_ALLOW_PAID)

  const rank = (id: string): number => {
    const i = order.indexOf(id)
    return i === -1 ? order.length + PROVIDER_REGISTRY.findIndex((p) => p.id === id) : i
  }

  const active: ActiveProvider[] = []
  for (const def of PROVIDER_REGISTRY) {
    const apiKey =
      env[def.apiKeyEnv]?.trim() ||
      def.apiKeyEnvAliases?.map((name) => env[name]?.trim()).find(Boolean)
    if (!apiKey) continue
    if (def.tier === 'paid' && !allowPaid) continue

    // OpenRouter historically used OPENROUTER_PRESET for the model id.
    const legacyModel = def.id === 'openrouter' ? env.OPENROUTER_PRESET?.trim() : undefined
    const override = (def.modelEnv ? env[def.modelEnv]?.trim() : undefined) || legacyModel
    const models = override
      ? override.split(',').map((m) => m.trim()).filter(Boolean)
      : [def.defaultModel, ...(def.fallbackModels ?? [])]

    active.push({
      id: def.id,
      label: def.label,
      tier: def.tier,
      protocol: def.protocol,
      baseUrl: def.baseUrl,
      apiKey,
      model: models[0],
      models,
    })
  }

  // Priority order, then a stable free-before-paid partition.
  active.sort((a, b) => rank(a.id) - rank(b.id))
  const free = active.filter((p) => p.tier === 'free')
  const paid = active.filter((p) => p.tier === 'paid')
  return [...free, ...paid]
}
