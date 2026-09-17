import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetchProfile = vi.fn()
const storage = new Map<string, unknown>()

vi.mock('../src/background/api', () => ({
  getToken: async () => (storage.get('jobmagnateExtensionToken') as string) ?? null,
  setToken: async (token: string) => { storage.set('jobmagnateExtensionToken', token) },
  clearToken: async () => { storage.delete('jobmagnateExtensionToken') },
  fetchProfile: () => mockFetchProfile(),
  requestFill: vi.fn(),
  requestFieldMap: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message)
    }
  },
}))

import { connectWithToken } from '../src/background/index'
import { ApiError } from '../src/background/api'

beforeEach(() => {
  storage.clear()
  mockFetchProfile.mockReset()
})

describe('connectWithToken', () => {
  it('stores the token and reports success when the backend accepts it', async () => {
    mockFetchProfile.mockResolvedValue({ profile: {}, plan: 'FREE', remainingFills: 5 })

    const result = await connectWithToken('ext_valid')

    expect(result.ok).toBe(true)
    expect(storage.get('jobmagnateExtensionToken')).toBe('ext_valid')
  })

  it('does not leave an invalid token stored, and reports a clear message', async () => {
    mockFetchProfile.mockRejectedValue(new ApiError(401, 'INVALID_TOKEN', 'invalid'))

    const result = await connectWithToken('ext_bad')

    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/invalid or has been revoked/i)
    expect(storage.has('jobmagnateExtensionToken')).toBe(false)
  })

  it('reports a network-ish failure distinctly from an invalid token', async () => {
    mockFetchProfile.mockRejectedValue(new Error('Failed to fetch'))

    const result = await connectWithToken('ext_whatever')

    expect(result.ok).toBe(false)
    expect(result.message).toBe('Failed to fetch')
    expect(storage.has('jobmagnateExtensionToken')).toBe(false)
  })
})
