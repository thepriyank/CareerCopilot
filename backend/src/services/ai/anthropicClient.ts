import Anthropic from '@anthropic-ai/sdk'
import { config, prisma } from '../../config'
import { logger } from '../../utils/logger'

let _client: Anthropic | null = null

function getClient(apiKey?: string): Anthropic {
  const key = apiKey ?? config.anthropic.apiKey
  if (!key) {
    throw new Error('No Anthropic API key configured. Set ANTHROPIC_API_KEY in .env')
  }
  if (!_client || apiKey) {
    return new Anthropic({ apiKey: key })
  }
  if (!_client) {
    _client = new Anthropic({ apiKey: key })
  }
  return _client
}

export interface GenerateOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
  userApiKey?: string
  userId?: string
  feature?: string
}

export async function generate(prompt: string, options: GenerateOptions = {}): Promise<string> {
  const {
    model = config.anthropic.model,
    maxTokens = 4096,
    systemPrompt,
    userApiKey,
    userId,
    feature,
  } = options

  const client = getClient(userApiKey)
  const apiKeySource = userApiKey ? 'user' : 'platform'

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]

  logger.debug(`Calling Claude model=${model} feature=${feature ?? 'unknown'}`)

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(systemPrompt && { system: systemPrompt }),
    messages,
  })

  const inputTokens = response.usage.input_tokens
  const outputTokens = response.usage.output_tokens
  const totalTokens = inputTokens + outputTokens

  // Log usage to DB (fire and forget; don't block the response)
  if (userId) {
    prisma.modelUsageRecord
      .create({
        data: {
          userId,
          modelName: model,
          apiKeySource,
          tokensUsed: totalTokens,
          feature: feature ?? null,
        },
      })
      .catch((err: Error) => logger.warn('Failed to log model usage', { err: err.message }))
  }

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }
  return content.text
}

export async function generateJson<T>(
  prompt: string,
  options: GenerateOptions = {}
): Promise<T> {
  const text = await generate(prompt, {
    ...options,
    systemPrompt:
      options.systemPrompt ??
      'You are a helpful assistant. Always respond with valid JSON only, no markdown fences or extra text.',
  })

  // Strip markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    logger.error('Failed to parse Claude JSON response', { response: cleaned.slice(0, 200) })
    throw new Error('AI returned malformed JSON')
  }
}
