const mockGet = jest.fn()
const mockSet = jest.fn()

jest.mock('../../src/services/cache/redisClient', () => ({
  getRedisClient: jest.fn(),
}))

import { getRedisClient } from '../../src/services/cache/redisClient'
import { getCached, setCached, cacheKey } from '../../src/services/cache/llmCache'

const mockGetRedisClient = getRedisClient as jest.Mock

beforeEach(() => {
  mockGet.mockReset()
  mockSet.mockReset()
  mockGetRedisClient.mockReset()
})

describe('cacheKey', () => {
  it('is deterministic for identical inputs', () => {
    const a = cacheKey('json', 'user-1', 'tailor', 'sys', 'prompt text')
    const b = cacheKey('json', 'user-1', 'tailor', 'sys', 'prompt text')
    expect(a).toBe(b)
  })

  it('differs when the prompt differs', () => {
    const a = cacheKey('json', 'user-1', 'tailor', 'sys', 'prompt A')
    const b = cacheKey('json', 'user-1', 'tailor', 'sys', 'prompt B')
    expect(a).not.toBe(b)
  })

  it('differs across users for the same prompt (privacy-scoped, not shared)', () => {
    const a = cacheKey('json', 'user-1', 'tailor', 'sys', 'same prompt')
    const b = cacheKey('json', 'user-2', 'tailor', 'sys', 'same prompt')
    expect(a).not.toBe(b)
  })

  it('falls back to a stable "anon" bucket when there is no userId', () => {
    const a = cacheKey('json', undefined, 'tailor', 'sys', 'p')
    const b = cacheKey('json', undefined, 'tailor', 'sys', 'p')
    expect(a).toBe(b)
    expect(a).toContain('llmcache:anon:')
  })
})

describe('getCached / setCached', () => {
  it('returns null (a clean miss) when Redis is unavailable, never throwing', async () => {
    mockGetRedisClient.mockReturnValue(null)
    await expect(getCached('some-key')).resolves.toBeNull()
    await expect(setCached('some-key', { a: 1 })).resolves.toBeUndefined()
  })

  it('round-trips a JSON-serializable value through a real-shaped client', async () => {
    mockGetRedisClient.mockReturnValue({ get: mockGet, set: mockSet })
    mockSet.mockResolvedValue('OK')
    await setCached('k', { hello: 'world' })
    expect(mockSet).toHaveBeenCalledWith('k', JSON.stringify({ hello: 'world' }), 'EX', expect.any(Number))

    mockGet.mockResolvedValue(JSON.stringify({ hello: 'world' }))
    const result = await getCached<{ hello: string }>('k')
    expect(result).toEqual({ hello: 'world' })
  })

  it('treats a read error as a miss rather than throwing', async () => {
    mockGetRedisClient.mockReturnValue({ get: mockGet, set: mockSet })
    mockGet.mockRejectedValue(new Error('connection reset'))
    await expect(getCached('k')).resolves.toBeNull()
  })

  it('swallows a write error rather than failing the caller', async () => {
    mockGetRedisClient.mockReturnValue({ get: mockGet, set: mockSet })
    mockSet.mockRejectedValue(new Error('connection reset'))
    await expect(setCached('k', { a: 1 })).resolves.toBeUndefined()
  })
})
