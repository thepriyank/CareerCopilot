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
  /** Env var that overrides the model, if the operator wants a different one. */
  modelEnv?: string
  /** Model used when `modelEnv` is unset. */
  defaultModel: string
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
    defaultModel: 'openai/gpt-oss-20b',
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
    defaultModel: 'gemini-2.5-flash-lite',
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
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
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
  model: string
}

const DEFAULT_ORDER = 'groq,cerebras,gemini,ollama,openrouter,deepseek,anthropic,openai'

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
    const model = (def.modelEnv ? env[def.modelEnv]?.trim() : undefined) || legacyModel || def.defaultModel

    active.push({
      id: def.id,
      label: def.label,
      tier: def.tier,
      protocol: def.protocol,
      baseUrl: def.baseUrl,
      apiKey,
      model,
    })
  }

  // Priority order, then a stable free-before-paid partition.
  active.sort((a, b) => rank(a.id) - rank(b.id))
  const free = active.filter((p) => p.tier === 'free')
  const paid = active.filter((p) => p.tier === 'paid')
  return [...free, ...paid]
}
