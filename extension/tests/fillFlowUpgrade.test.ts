import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequestFill = vi.fn()
const mockRequestFieldMap = vi.fn()

vi.mock('../src/background/api', () => ({
  getToken: async () => 'ext_valid',
  setToken: async () => {},
  clearToken: async () => {},
  fetchProfile: vi.fn(),
  requestFill: (...a: unknown[]) => mockRequestFill(...a),
  requestFieldMap: (...a: unknown[]) => mockRequestFieldMap(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message)
    }
  },
}))

import { runFillFlow } from '../src/background/index'
import { ApiError } from '../src/background/api'

const chromeStub = (globalThis as unknown as { chrome: { tabs: Record<string, unknown> } }).chrome

beforeEach(() => {
  mockRequestFill.mockReset()
  mockRequestFieldMap.mockReset().mockResolvedValue({ mapping: {} })
  chromeStub.tabs.get = async () => ({ url: 'https://boards.example.com/jobs/1/apply' })
  chromeStub.tabs.sendMessage = async () => ({ schema: [{ id: 'f1', label: 'Email' }] })
})

describe('runFillFlow — out of free autofills (NM-5)', () => {
  it('flags the result for an upgrade prompt on a 402', async () => {
    mockRequestFill.mockRejectedValue(new ApiError(402, 'OUT_OF_CREDITS', "You've used all 5 autofills"))

    const result = await runFillFlow(1)

    expect(result.ok).toBe(false)
    expect(result.upgrade).toBe(true)
    expect(result.message).toMatch(/unlimited autofills/i)
  })

  it('does not offer an upgrade for other errors', async () => {
    mockRequestFill.mockRejectedValue(new ApiError(403, 'PLATFORM_EXCLUDED', 'excluded'))

    const result = await runFillFlow(1)

    expect(result.ok).toBe(false)
    expect(result.upgrade).toBeUndefined()
  })
})
