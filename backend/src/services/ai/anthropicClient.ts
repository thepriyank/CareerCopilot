import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { config } from '../../config'
import { AppDataSource } from '../../config/dataSource'
import { ModelUsageRecord } from '../../entities/ModelUsageRecord'
import { User } from '../../entities/User'
import { decrypt } from '../../utils/encryption'
import { parseModelConnection, ModelConnection, LocalModelConnection } from './modelConnection'
import { ActiveProvider } from './providerRegistry'
import { usableChain, fullChain, handleProviderFailure } from './providerChain'
import { logger } from '../../utils/logger'
import { cacheKey, getCached, setCached } from '../cache/llmCache'

export interface GenerateOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
  userApiKey?: string
  userId?: string
  feature?: string
}

/**
 * Resolves what connection this call should actually use:
 * 1. An explicit per-call override (`userApiKey` — the name predates local
 *    connections, but it goes through the same parser now, so it can hold
 *    a full local connection string too).
 * 2. The calling user's saved Settings → API keys connection, if any.
 * 3. Nothing — caller falls back to the platform default Anthropic key.
 *
 * A stored connection that fails to decrypt or parse (e.g. the encryption
 * key rotated, or a since-invalidated value) logs a warning and falls back
 * to the platform default rather than failing the whole generation.
 */
async function resolveConnection(options: GenerateOptions): Promise<ModelConnection | null> {
  if (options.userApiKey) {
    return parseModelConnection(options.userApiKey)
  }
  if (options.userId) {
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ id: options.userId })
    const stored = user?.settings?.['modelConnection']
    if (typeof stored === 'string' && stored) {
      try {
        return parseModelConnection(decrypt(stored))
      } catch (err) {
        logger.warn('Stored model connection could not be used, falling back to platform default', {
          userId: options.userId,
          err: (err as Error).message,
        })
      }
    }
  }
  return null
}

// One client per distinct credential, reused across calls.
const anthropicClients = new Map<string, Anthropic>()
function anthropicClientFor(apiKey: string): Anthropic {
  let client = anthropicClients.get(apiKey)
  if (!client) {
    client = new Anthropic({ apiKey })
    anthropicClients.set(apiKey, client)
  }
  return client
}

const openaiClients = new Map<string, OpenAI>()
function openaiClientFor(baseUrl: string, apiKey: string): OpenAI {
  const key = `${baseUrl} ${apiKey}`
  let client = openaiClients.get(key)
  if (!client) {
    client = new OpenAI({ baseURL: baseUrl, apiKey })
    openaiClients.set(key, client)
  }
  return client
}

interface GenerateResult {
  text: string
  tokensUsed: number
}

async function generateViaAnthropic(
  prompt: string,
  systemPrompt: string | undefined,
  model: string,
  maxTokens: number,
  apiKey: string
): Promise<GenerateResult> {
  const client = anthropicClientFor(apiKey)

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(systemPrompt && { system: systemPrompt }),
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }
  return { text: content.text, tokensUsed: response.usage.input_tokens + response.usage.output_tokens }
}

/**
 * Talks to any OpenAI-compatible endpoint — Ollama, LM Studio, llama.cpp's
 * server, vLLM, text-generation-webui, koboldcpp, LocalAI, or a hosted
 * OpenAI-compatible gateway (OpenRouter, Groq, Together.ai, OpenAI itself).
 * The `apiKey` most local servers ignore entirely; the SDK still requires a
 * non-empty string to construct the client.
 */
async function generateViaLocal(
  prompt: string,
  systemPrompt: string | undefined,
  connection: LocalModelConnection,
  maxTokens: number
): Promise<GenerateResult> {
  const client = new OpenAI({ baseURL: connection.baseUrl, apiKey: 'local' })

  const response = await client.chat.completions.create({
    model: connection.model,
    max_tokens: maxTokens,
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error(`No response text from local model "${connection.model}" at ${connection.baseUrl}`)
  }
  return { text, tokensUsed: response.usage?.total_tokens ?? 0 }
}

/**
 * Calls one provider from the platform chain over whichever wire protocol it
 * speaks. Throws on any failure — the caller (`runPlatformChain`) is what
 * decides whether to bench this provider and move to the next.
 */
async function generateViaProvider(
  provider: ActiveProvider,
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number
): Promise<GenerateResult> {
  if (provider.protocol === 'anthropic') {
    return generateViaAnthropic(prompt, systemPrompt, provider.model, maxTokens, provider.apiKey)
  }

  const client = openaiClientFor(provider.baseUrl as string, provider.apiKey)
  const response = await client.chat.completions.create({
    model: provider.model,
    max_tokens: maxTokens,
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user' as const, content: prompt },
    ],
  })

  const text = response.choices[0]?.message?.content
  if (!text) {
    throw new Error(`No response text from ${provider.id} model "${provider.model}"`)
  }
  return { text, tokensUsed: response.usage?.total_tokens ?? 0 }
}

interface ChainResult extends GenerateResult {
  provider: ActiveProvider
}

/**
 * Walks the configured provider chain (free tier first, then paid if
 * `LLM_ALLOW_PAID`), skipping any provider currently benched from an earlier
 * failure. Returns on the first success; benches providers as they fail per
 * `handleProviderFailure`'s policy. Throws only when the whole chain is
 * unavailable or every provider failed this call.
 */
async function runPlatformChain(
  prompt: string,
  systemPrompt: string | undefined,
  maxTokens: number,
  excludeIds?: Set<string>
): Promise<ChainResult> {
  const chain = excludeIds ? usableChain().filter((p) => !excludeIds.has(p.id)) : usableChain()
  if (chain.length === 0) {
    const configured = fullChain()
    if (configured.length === 0) {
      throw new Error(
        'No LLM providers configured. Set at least one provider API key ' +
          '(e.g. GROQ_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, OLLAMA_API_KEY) in backend/.env, ' +
          'or set LLM_ALLOW_PAID=true alongside ANTHROPIC_API_KEY.'
      )
    }
    throw new Error(
      `All ${configured.length} configured LLM provider(s) are currently benched ` +
        `(rate-limited or disabled): ${configured.map((p) => p.id).join(', ')}. ` +
        'Wait for a cooldown to elapse or add another provider key.'
    )
  }

  let lastErr: unknown
  let lastProviderId = ''
  for (const provider of chain) {
    lastProviderId = provider.id
    try {
      const result = await generateViaProvider(provider, prompt, systemPrompt, maxTokens)
      logger.debug(`LLM call served by "${provider.id}" (${provider.model})`)
      return { ...result, provider }
    } catch (err) {
      lastErr = err
      handleProviderFailure(provider.id, err)
    }
  }

  throw new Error(
    `Every LLM provider in the chain failed for this call. Last attempt "${lastProviderId}": ` +
      ((lastErr as Error)?.message ?? String(lastErr))
  )
}

interface GenerateCoreResult {
  text: string
  /** Only set when served by the platform chain — lets generateJson() exclude
   * this exact provider on a retry after a malformed-JSON response, without
   * treating it as a transport failure (it answered fine, just not as JSON). */
  providerId?: string
}

async function generateCore(
  prompt: string,
  options: GenerateOptions,
  excludeProviderIds?: Set<string>
): Promise<GenerateCoreResult> {
  const { maxTokens = 4096, systemPrompt, feature, userId } = options

  const connection = await resolveConnection(options)

  let result: GenerateResult
  let apiKeySource: 'platform' | 'user-cloud' | 'user-local'
  let modelName: string
  let providerId: string | undefined

  if (connection?.kind === 'local') {
    logger.debug(`LLM call feature=${feature ?? 'unknown'} source=user-local`)
    result = await generateViaLocal(prompt, systemPrompt, connection, maxTokens)
    apiKeySource = 'user-local'
    modelName = connection.model
  } else if (connection?.kind === 'cloud') {
    logger.debug(`LLM call feature=${feature ?? 'unknown'} source=user-cloud`)
    const model = options.model ?? config.anthropic.model
    result = await generateViaAnthropic(prompt, systemPrompt, model, maxTokens, connection.apiKey)
    apiKeySource = 'user-cloud'
    modelName = model
  } else {
    logger.debug(`LLM call feature=${feature ?? 'unknown'} source=platform-chain`)
    const chained = await runPlatformChain(prompt, systemPrompt, maxTokens, excludeProviderIds)
    result = chained
    apiKeySource = 'platform'
    modelName = `${chained.provider.id}/${chained.provider.model}`
    providerId = chained.provider.id
  }

  // Log usage to DB (fire and forget; don't block the response)
  if (userId) {
    const modelUsageRepo = AppDataSource.getRepository(ModelUsageRecord)
    const usageRecord = modelUsageRepo.create({
      userId,
      modelName,
      apiKeySource,
      tokensUsed: result.tokensUsed,
      feature: feature ?? null,
    })
    modelUsageRepo.save(usageRecord)
      .catch((err: Error) => logger.warn('Failed to log model usage', { err: err.message }))
  }

  return { text: result.text, providerId }
}

async function generateUncached(prompt: string, options: GenerateOptions = {}): Promise<string> {
  return (await generateCore(prompt, options)).text
}

/**
 * Cached at this public boundary, not inside generateCore — a cache hit
 * here skips the whole provider chain (and the malformed-JSON retry loop
 * for generateJson below), which is exactly the "don't spend quota
 * re-generating the same thing" the cache exists for. See
 * services/cache/llmCache.ts's header comment for why this layer, not
 * generateCore, is the caching boundary.
 */
export async function generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const key = cacheKey('text', options.userId, options.feature, options.systemPrompt, prompt)
  const cached = await getCached<string>(key)
  if (cached !== null) return cached

  const result = await generateUncached(prompt, options)
  await setCached(key, result)
  return result
}

// Free/open-weight models are weaker at strict JSON adherence than Claude —
// when one returns unparseable JSON, retry against the next provider in the
// chain rather than failing the whole call. This is deliberately separate
// from runPlatformChain's own retry-on-transport-failure: the provider
// answered fine here, it just didn't follow the format, so it isn't benched
// (a future call with a different prompt may work fine on the same provider).
const MAX_JSON_ATTEMPTS = 3

async function generateJsonUncached<T>(
  prompt: string,
  options: GenerateOptions = {}
): Promise<T> {
  const systemPrompt =
    options.systemPrompt ??
    'You are a helpful assistant. Always respond with valid JSON only, no markdown fences or extra text.'

  const excludeProviderIds = new Set<string>()
  let lastErr: Error = new Error('AI returned malformed JSON')

  for (let attempt = 1; attempt <= MAX_JSON_ATTEMPTS; attempt++) {
    let text: string
    let providerId: string | undefined
    try {
      ;({ text, providerId } = await generateCore(prompt, { ...options, systemPrompt }, excludeProviderIds))
    } catch (err) {
      // Excluding providers for the retry can exhaust the chain (runPlatformChain
      // throws "currently benched", which is misleading here — they aren't
      // benched, just excluded for this call). Surface the real cause instead.
      if (attempt > 1) break
      throw err
    }

    // Different providers wrap JSON differently: ```json fences (most), single
    // backticks (Gemini sometimes), or a line of prose before the object. Strip
    // the common wrappers, then fall back to slicing out the first {...} / [...].
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^`+|`+$/g, '')
      .trim()

    try {
      return JSON.parse(cleaned) as T
    } catch {
      const match = cleaned.match(/[{[][\s\S]*[}\]]/)
      if (match) {
        try {
          return JSON.parse(match[0]) as T
        } catch {
          /* fall through to the retry-or-throw below */
        }
      }
    }

    lastErr = new Error('AI returned malformed JSON')
    const canRetry = providerId !== undefined && attempt < MAX_JSON_ATTEMPTS
    logger.warn(
      `LLM provider "${providerId ?? 'unknown'}" returned malformed JSON` +
        (canRetry ? '; retrying with a different provider' : ''),
      { response: cleaned.slice(0, 200) }
    )
    // no fallback chain to retry against (user cloud/local connection), or out of attempts
    if (!canRetry || providerId === undefined) break
    excludeProviderIds.add(providerId)
  }

  logger.error('Failed to parse AI JSON response after retries')
  throw lastErr
}

/** Cached wrapper — see generate()'s comment above; same reasoning applies here. */
export async function generateJson<T>(prompt: string, options: GenerateOptions = {}): Promise<T> {
  const key = cacheKey('json', options.userId, options.feature, options.systemPrompt, prompt)
  const cached = await getCached<T>(key)
  if (cached !== null) return cached

  const result = await generateJsonUncached<T>(prompt, options)
  await setCached(key, result)
  return result
}
