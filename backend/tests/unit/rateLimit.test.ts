const mockIncr = jest.fn()
const mockExpire = jest.fn()

jest.mock('../../src/services/cache/redisClient', () => ({
  getRedisClient: jest.fn(),
}))

import { getRedisClient } from '../../src/services/cache/redisClient'
import { llmRateLimit } from '../../src/middleware/rateLimit'
import { AuthRequest } from '../../src/types'
import { Response } from 'express'

const mockGetRedisClient = getRedisClient as jest.Mock

function fakeReq(userId = 'user-1'): AuthRequest {
  return { userId } as AuthRequest
}
function fakeRes(): Response {
  return {} as Response
}

beforeEach(() => {
  mockIncr.mockReset()
  mockExpire.mockReset()
  mockGetRedisClient.mockReset()
})

describe('llmRateLimit', () => {
  it('passes through with no error when Redis is unavailable (fails open)', async () => {
    mockGetRedisClient.mockReturnValue(null)
    const next = jest.fn()
    await llmRateLimit(fakeReq(), fakeRes(), next)
    expect(next).toHaveBeenCalledWith() // called with no args = allowed through
  })

  it('allows a request under the limit', async () => {
    mockGetRedisClient.mockReturnValue({ incr: mockIncr, expire: mockExpire })
    mockIncr.mockResolvedValue(5) // well under the default limit
    const next = jest.fn()
    await llmRateLimit(fakeReq(), fakeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('sets an expiry only on the first hit of a window', async () => {
    mockGetRedisClient.mockReturnValue({ incr: mockIncr, expire: mockExpire })
    mockIncr.mockResolvedValue(1)
    await llmRateLimit(fakeReq(), fakeRes(), jest.fn())
    expect(mockExpire).toHaveBeenCalledTimes(1)

    mockExpire.mockClear()
    mockIncr.mockResolvedValue(2)
    await llmRateLimit(fakeReq(), fakeRes(), jest.fn())
    expect(mockExpire).not.toHaveBeenCalled()
  })

  it('rejects with 429 once the per-user limit is exceeded', async () => {
    mockGetRedisClient.mockReturnValue({ incr: mockIncr, expire: mockExpire })
    mockIncr.mockResolvedValue(21) // over the default 20/window limit
    const next = jest.fn()
    await llmRateLimit(fakeReq(), fakeRes(), next)

    expect(next).toHaveBeenCalledTimes(1)
    const errArg = next.mock.calls[0][0]
    expect(errArg).toBeDefined()
    expect(errArg.statusCode).toBe(429)
    expect(errArg.code).toBe('RATE_LIMITED')
  })

  it('scopes the counter per user — one user hitting the limit does not affect another', async () => {
    mockGetRedisClient.mockReturnValue({ incr: mockIncr, expire: mockExpire })
    mockIncr.mockResolvedValue(1)
    await llmRateLimit(fakeReq('user-a'), fakeRes(), jest.fn())
    await llmRateLimit(fakeReq('user-b'), fakeRes(), jest.fn())

    const keysUsed = mockIncr.mock.calls.map((c) => c[0] as string)
    expect(keysUsed[0]).toContain('user-a')
    expect(keysUsed[1]).toContain('user-b')
    expect(keysUsed[0]).not.toBe(keysUsed[1])
  })

  it('fails open (allows the request) when Redis errors mid-check', async () => {
    mockGetRedisClient.mockReturnValue({ incr: mockIncr, expire: mockExpire })
    mockIncr.mockRejectedValue(new Error('connection reset'))
    const next = jest.fn()
    await llmRateLimit(fakeReq(), fakeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })
})
