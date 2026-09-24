/**
 * Routing tests for generate()'s platform provider chain.
 *
 * With no user-supplied connection, generate() walks `config.llm.providers` in
 * order: it uses the first provider that answers, benches a provider that hits
 * a rate limit / quota and moves to the next, and only reaches a paid provider
 * once every free one is exhausted.
 *
 * Each test isolates its own module registry (jest.isolateModules) so a
 * different fake `config.llm.providers` can be in effect per test, and so the
 * in-memory bench map in providerChain.ts starts empty.
 */

const mockAnthropicCreate = jest.fn()
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  }))
})

const mockOpenAiCreate = jest.fn()
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAiCreate } },
  }))
})

jest.mock('../../src/config/dataSource', () => ({
  AppDataSource: { getRepository: jest.fn() },
}))

beforeEach(() => {
  mockAnthropicCreate.mockReset()
  mockOpenAiCreate.mockReset()
})

type Provider = {
  id: string
  label: string
  tier: 'free' | 'paid'
  protocol: 'openai' | 'anthropic'
  baseUrl?: string
  apiKey: string
  model: string
}

const P = {
  gemini: {
    id: 'gemini', label: 'Gemini', tier: 'free', protocol: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: 'gm-key', model: 'gemini-2.5-flash-lite',
  } as Provider,
  groq: {
    id: 'groq', label: 'Groq', tier: 'free', protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'gq-key', model: 'llama-3.3-70b-versatile',
  } as Provider,
  ollama: {
    id: 'ollama', label: 'Ollama Cloud', tier: 'free', protocol: 'openai',
    baseUrl: 'https://ollama.com/v1', apiKey: 'ol-key', model: 'gpt-oss:20b',
  } as Provider,
  anthropic: {
    id: 'anthropic', label: 'Anthropic', tier: 'paid', protocol: 'anthropic',
    apiKey: 'sk-ant-real', model: 'claude-haiku-4-5-20251001',
  } as Provider,
}

function loadGenerate(providers: Provider[]) {
  let mod!: typeof import('../../src/services/ai/anthropicClient')
  jest.isolateModules(() => {
    jest.doMock('../../src/config', () => ({
      config: {
        anthropic: { apiKey: 'sk-ant-placeholder', model: 'claude-haiku-4-5-20251001', generationModel: 'claude-sonnet-4-6' },
        openrouter: { apiKey: '', model: '' },
        llm: { providers, cooldownMs: 900_000, billingCooldownMs: 3_600_000, fatalCooldownMs: 21_600_000, attemptTimeoutMs: 45_000, callDeadlineMs: 90_000, catalogCacheTtlMs: 600_000, allowPaid: providers.some((p) => p.tier === 'paid') },
        settingsEncryptionKey: 'x'.repeat(64),
        redis: { url: '', llmCacheTtlSeconds: 3600 }, // unset → llmCache.ts no-ops, same as no caching existed
      },
    }))
    mod = require('../../src/services/ai/anthropicClient')
  })
  return mod
}

// Platform-chain calls always pass a per-attempt timeout and disable the
// SDK's own retries (NM-29) — the chain is the retry policy.
const PLATFORM_OPTS = expect.objectContaining({ maxRetries: 0, timeout: expect.any(Number) })

const openAiReply = (content: string, total = 10) => ({
  choices: [{ message: { content } }],
  usage: { total_tokens: total },
})
const anthropicReply = (text: string) => ({
  content: [{ type: 'text', text }],
  usage: { input_tokens: 5, output_tokens: 5 },
})

describe('generate() platform provider chain', () => {
  it('uses the first free provider when it answers', async () => {
    const { generate } = loadGenerate([P.gemini, P.anthropic])
    mockOpenAiCreate.mockResolvedValue(openAiReply('hi from gemini'))

    const result = await generate('a prompt')

    expect(result).toBe('hi from gemini')
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1)
    expect(mockOpenAiCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-2.5-flash-lite' }), PLATFORM_OPTS)
    expect(mockAnthropicCreate).not.toHaveBeenCalled()
  })

  it('falls through to the next free provider on a 429 and benches the first', async () => {
    const { generate } = loadGenerate([P.groq, P.gemini])
    mockOpenAiCreate
      .mockRejectedValueOnce(Object.assign(new Error('Too Many Requests'), { status: 429 }))
      .mockResolvedValueOnce(openAiReply('hi from gemini'))
      .mockResolvedValue(openAiReply('hi from gemini'))

    const first = await generate('prompt one')
    expect(first).toBe('hi from gemini')
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2)
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'llama-3.3-70b-versatile' }), PLATFORM_OPTS)
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-2.5-flash-lite' }), PLATFORM_OPTS)

    // groq is now benched — the next call skips straight to gemini.
    const second = await generate('prompt two')
    expect(second).toBe('hi from gemini')
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(3)
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: 'gemini-2.5-flash-lite' }), PLATFORM_OPTS)
  })

  it("tries the provider's next model when one is rate-limited, and benches only that model", async () => {
    const openrouter = {
      id: 'openrouter', label: 'OpenRouter', tier: 'free', protocol: 'openai', baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'or', model: 'a:free', models: ['a:free', 'b:free'],
    } as Provider & { models: string[] }
    const { generate } = loadGenerate([openrouter, P.gemini])
    mockOpenAiCreate
      .mockRejectedValueOnce(Object.assign(new Error('a:free is temporarily rate-limited upstream'), { status: 429 }))
      .mockResolvedValueOnce(openAiReply('hi from b'))
      .mockResolvedValueOnce(openAiReply('hi from b again'))

    expect(await generate('one')).toBe('hi from b')
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'b:free' }), PLATFORM_OPTS)
    // a:free is benched, but the provider isn't — the next call goes straight to b:free, not gemini.
    expect(await generate('two')).toBe('hi from b again')
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: 'b:free' }), PLATFORM_OPTS)
  })

  it("skips a provider's remaining models on a 402 (billing is account-wide)", async () => {
    const cerebras = {
      id: 'cerebras', label: 'Cerebras', tier: 'free', protocol: 'openai', baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: 'cb', model: 'm1', models: ['m1', 'm2'],
    } as Provider & { models: string[] }
    const { generate } = loadGenerate([cerebras, P.gemini])
    mockOpenAiCreate
      .mockRejectedValueOnce(Object.assign(new Error('402 status code (no body)'), { status: 402 }))
      .mockResolvedValueOnce(openAiReply('hi from gemini'))

    expect(await generate('a prompt')).toBe('hi from gemini')
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2)
    expect(mockOpenAiCreate.mock.calls.map(([body]) => body.model)).toEqual(['m1', 'gemini-2.5-flash-lite'])
  })

  it('falls through on an empty response without benching that provider', async () => {
    const { generate } = loadGenerate([P.ollama, P.gemini])
    mockOpenAiCreate
      .mockResolvedValueOnce({ choices: [{ message: { content: '' }, finish_reason: 'length' }], usage: { total_tokens: 4096 } })
      .mockResolvedValueOnce(openAiReply('hi from gemini'))
      .mockResolvedValueOnce(openAiReply('hi from ollama'))

    expect(await generate('prompt one')).toBe('hi from gemini')
    // ollama wasn't benched — the next call tries it first again.
    expect(await generate('prompt two')).toBe('hi from ollama')
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: 'gpt-oss:20b' }), PLATFORM_OPTS)
  })

  it('asks gpt-oss models for low reasoning effort, and nothing else', async () => {
    const { generate } = loadGenerate([P.ollama, P.gemini])
    mockOpenAiCreate
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 503 }))
      .mockResolvedValueOnce(openAiReply('ok'))

    await generate('a prompt')

    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'gpt-oss:20b', reasoning_effort: 'low' }), PLATFORM_OPTS)
    expect(mockOpenAiCreate.mock.calls[1][0]).not.toHaveProperty('reasoning_effort')
  })

  it('reaches a paid provider only after every free provider has failed', async () => {
    const { generate } = loadGenerate([P.gemini, P.anthropic])
    mockOpenAiCreate.mockRejectedValue(Object.assign(new Error('quota exceeded'), { status: 429 }))
    mockAnthropicCreate.mockResolvedValue(anthropicReply('hi from claude'))

    const result = await generate('a prompt')

    expect(result).toBe('hi from claude')
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1)
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
  })

  it('throws a helpful error when no providers are configured', async () => {
    const { generate } = loadGenerate([])
    await expect(generate('a prompt')).rejects.toThrow(/No LLM providers configured/)
  })

  it('throws when every configured provider is benched', async () => {
    const { generate } = loadGenerate([P.gemini])
    mockOpenAiCreate.mockRejectedValue(Object.assign(new Error('bad key'), { status: 401 }))

    await expect(generate('call one')).rejects.toThrow(/Every LLM provider in the chain failed/)
    // 401 disables gemini for the process; the next call finds the chain empty.
    await expect(generate('call two')).rejects.toThrow(/currently benched/)
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1)
  })

  it('still prefers an explicit user-supplied local connection over the chain', async () => {
    const { generate } = loadGenerate([P.gemini])
    mockOpenAiCreate.mockResolvedValue(openAiReply('hello from local', 7))

    const result = await generate('a prompt', { userApiKey: 'http://localhost:11434/v1#model=gemma4:latest' })

    expect(result).toBe('hello from local')
    expect(mockOpenAiCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemma4:latest' }))
  })

  it('routes an explicit user-supplied cloud key straight to Anthropic', async () => {
    const { generate } = loadGenerate([P.gemini])
    mockAnthropicCreate.mockResolvedValue(anthropicReply('hello from user claude'))

    const result = await generate('a prompt', { userApiKey: 'sk-ant-user-key' })

    expect(result).toBe('hello from user claude')
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
    expect(mockOpenAiCreate).not.toHaveBeenCalled()
  })
})

describe('generate() time limits (NM-29)', () => {
  afterEach(() => jest.restoreAllMocks())

  it('benches a model that timed out, so the next call skips it', async () => {
    const or = { ...P.gemini, id: 'openrouter', model: 'slow:free', models: ['slow:free', 'fast:free'] } as Provider & { models: string[] }
    const { generate } = loadGenerate([or])
    mockOpenAiCreate
      .mockRejectedValueOnce(Object.assign(new Error('Request timed out.'), { name: 'APIConnectionTimeoutError' }))
      .mockResolvedValueOnce(openAiReply('from fast'))
      .mockResolvedValueOnce(openAiReply('from fast again'))

    expect(await generate('one')).toBe('from fast')
    expect(await generate('two')).toBe('from fast again')
    expect(mockOpenAiCreate.mock.calls.map(([body]) => body.model)).toEqual(['slow:free', 'fast:free', 'fast:free'])
  })

  it('stops trying further models once the whole-call deadline has passed', async () => {
    let now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    const { generate } = loadGenerate([P.groq, P.gemini])
    // groq fails after "100 seconds" — past the 90s call deadline.
    mockOpenAiCreate.mockImplementationOnce(async () => {
      now += 100_000
      throw Object.assign(new Error('boom'), { status: 503 })
    })

    await expect(generate('a prompt')).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1) // gemini never attempted
  })

  it('gives each attempt no more than the time left before the deadline', async () => {
    let now = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => now)
    const { generate } = loadGenerate([P.groq, P.gemini])
    mockOpenAiCreate
      .mockImplementationOnce(async () => {
        now += 70_000 // 20s left of the 90s deadline
        throw Object.assign(new Error('boom'), { status: 503 })
      })
      .mockResolvedValueOnce(openAiReply('hi from gemini'))

    expect(await generate('a prompt')).toBe('hi from gemini')
    expect(mockOpenAiCreate.mock.calls[0][1]).toMatchObject({ timeout: 45_000, maxRetries: 0 })
    expect(mockOpenAiCreate.mock.calls[1][1]).toMatchObject({ timeout: 20_000, maxRetries: 0 })
  })
})

describe('generateJson() malformed-JSON retry', () => {
  it('parses a clean JSON response on the first try', async () => {
    const { generateJson } = loadGenerate([P.gemini])
    mockOpenAiCreate.mockResolvedValue(openAiReply('{"ok": true}'))

    const result = await generateJson<{ ok: boolean }>('a prompt')
    expect(result).toEqual({ ok: true })
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1)
  })

  it('retries against the next provider when one returns malformed JSON, without benching it', async () => {
    const { generateJson } = loadGenerate([P.groq, P.gemini])
    mockOpenAiCreate
      .mockResolvedValueOnce(openAiReply('{"skills": [ this is not valid json'))
      .mockResolvedValueOnce(openAiReply('{"ok": true}'))

    const result = await generateJson<{ ok: boolean }>('a prompt')

    expect(result).toEqual({ ok: true })
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2)
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: 'llama-3.3-70b-versatile' }), PLATFORM_OPTS)
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: 'gemini-2.5-flash-lite' }), PLATFORM_OPTS)

    // Confirm groq was excluded only for the retry, not benched for the process.
    mockOpenAiCreate.mockResolvedValueOnce(openAiReply('{"again": true}'))
    const second = await generateJson<{ again: boolean }>('another prompt')
    expect(second).toEqual({ again: true })
    expect(mockOpenAiCreate).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: 'llama-3.3-70b-versatile' }), PLATFORM_OPTS)
  })

  it('throws after every provider in the chain returns malformed JSON', async () => {
    const { generateJson } = loadGenerate([P.groq, P.gemini])
    mockOpenAiCreate.mockResolvedValue(openAiReply('not json at all'))

    await expect(generateJson('a prompt')).rejects.toThrow(/malformed JSON/)
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2)
  })

  it('does not retry when the connection has no fallback chain (user-supplied key)', async () => {
    const { generateJson } = loadGenerate([P.gemini])
    mockAnthropicCreate.mockResolvedValue(anthropicReply('not json'))

    await expect(generateJson('a prompt', { userApiKey: 'sk-ant-user-key' })).rejects.toThrow(/malformed JSON/)
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
  })
})
