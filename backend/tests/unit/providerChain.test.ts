jest.mock('../../src/config', () => ({
  config: { llm: { providers: [], cooldownMs: 900_000, allowPaid: false } },
}))
jest.mock('../../src/utils/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

import {
  classifyFailure,
  retryAfterMs,
  isBenched,
  benchProvider,
  resetBench,
  handleProviderFailure,
} from '../../src/services/ai/providerChain'

afterEach(() => resetBench())

describe('classifyFailure()', () => {
  it('treats HTTP 429 and quota-ish messages as quota', () => {
    expect(classifyFailure({ status: 429 })).toBe('quota')
    expect(classifyFailure({ message: 'Rate limit exceeded for requests' })).toBe('quota')
    expect(classifyFailure({ error: { message: 'You have insufficient credits' } })).toBe('quota')
    expect(classifyFailure({ message: 'quota exceeded' })).toBe('quota')
  })

  it('treats 401/403 and auth messages as auth', () => {
    expect(classifyFailure({ status: 401 })).toBe('auth')
    expect(classifyFailure({ status: 403 })).toBe('auth')
    expect(classifyFailure({ message: 'invalid x-api-key' })).toBe('auth')
  })

  it('treats 5xx and network errors as transient', () => {
    expect(classifyFailure({ status: 503 })).toBe('transient')
    expect(classifyFailure({ code: 'ECONNRESET' })).toBe('transient')
    expect(classifyFailure({ name: 'APIConnectionTimeoutError' })).toBe('transient')
    expect(classifyFailure({ message: 'fetch failed' })).toBe('transient')
  })

  it('treats 400 / 404 / model-unavailable as fatal', () => {
    expect(classifyFailure({ status: 400 })).toBe('fatal')
    expect(classifyFailure({ status: 404, message: 'model not found' })).toBe('fatal')
    expect(classifyFailure({ message: 'This model is unavailable for free' })).toBe('fatal')
    expect(classifyFailure({})).toBe('fatal')
  })
})

describe('retryAfterMs()', () => {
  it('parses a numeric Retry-After header (seconds)', () => {
    expect(retryAfterMs({ headers: { 'retry-after': '30' } })).toBe(30_000)
  })
  it('parses a Headers-like object with a get() method', () => {
    const headers = { get: (k: string) => (k === 'retry-after' ? '12' : null) }
    expect(retryAfterMs({ headers })).toBe(12_000)
  })
  it('returns null when no Retry-After is present', () => {
    expect(retryAfterMs({ headers: {} })).toBeNull()
    expect(retryAfterMs({})).toBeNull()
  })
})

describe('bench state', () => {
  it('benches a provider for a bounded window and lets it expire', () => {
    benchProvider('groq', 60_000)
    const base = Date.now()
    expect(isBenched('groq', base + 30_000)).toBe(true)
    expect(isBenched('groq', base + 120_000)).toBe(false)
  })

  it('benches a provider for the whole process with Infinity', () => {
    benchProvider('ollama', Infinity)
    expect(isBenched('ollama', Date.now() + 10 ** 12)).toBe(true)
  })

  it('reports an unknown provider as not benched', () => {
    expect(isBenched('never-seen')).toBe(false)
  })
})

describe('handleProviderFailure()', () => {
  it('benches on a quota failure using the config cooldown when no Retry-After', () => {
    const kind = handleProviderFailure('groq', { status: 429, message: 'slow down' })
    expect(kind).toBe('quota')
    expect(isBenched('groq')).toBe(true)
  })

  it('benches on a quota failure using the Retry-After header when present', () => {
    handleProviderFailure('gemini', { status: 429, headers: { 'retry-after': '1' } })
    expect(isBenched('gemini', Date.now() + 500)).toBe(true)
    expect(isBenched('gemini', Date.now() + 5_000)).toBe(false)
  })

  it('disables a provider for the process on an auth failure', () => {
    handleProviderFailure('openrouter', { status: 401 })
    expect(isBenched('openrouter', Date.now() + 10 ** 12)).toBe(true)
  })

  it('does not bench a provider on a transient failure', () => {
    const kind = handleProviderFailure('cerebras', { status: 503 })
    expect(kind).toBe('transient')
    expect(isBenched('cerebras')).toBe(false)
  })
})
