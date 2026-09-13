import { createFakeRepo } from './testUtils/fakeRepo'

const fillRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { ExtensionFill } = require('../../src/entities/ExtensionFill')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ExtensionFill) return fillRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

import {
  currentFillWindowStart,
  countFillsInWindow,
  findRecentFill,
  FREE_MONTHLY_FILL_LIMIT,
  IDEMPOTENCY_WINDOW_MS,
} from '../../src/services/extension/quota'

beforeEach(() => {
  fillRepo.rows.length = 0
})

describe('currentFillWindowStart', () => {
  it('returns the signup date itself when less than a month has passed', () => {
    const createdAt = new Date('2026-09-01T00:00:00Z')
    const now = new Date('2026-09-15T00:00:00Z')
    expect(currentFillWindowStart(createdAt, now).toISOString()).toBe(createdAt.toISOString())
  })

  it('rolls forward to the most recent monthly anniversary, not a calendar-month boundary', () => {
    // Signed up on the 28th — three days later (the 31st/1st) must NOT be a
    // fresh window; the doc calls this out explicitly.
    const createdAt = new Date('2026-08-28T10:00:00Z')
    const now = new Date('2026-09-01T00:00:00Z')
    expect(currentFillWindowStart(createdAt, now).toISOString()).toBe(createdAt.toISOString())
  })

  it('advances one full month once the anniversary has passed', () => {
    const createdAt = new Date('2026-08-01T00:00:00Z')
    const now = new Date('2026-09-15T00:00:00Z')
    const start = currentFillWindowStart(createdAt, now)
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  it('advances multiple months for a long-dormant account', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const now = new Date('2026-09-15T00:00:00Z')
    const start = currentFillWindowStart(createdAt, now)
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('countFillsInWindow', () => {
  it('counts only fills at or after the window start', () => {
    const windowStart = new Date('2026-09-01T00:00:00Z')
    fillRepo.rows.push(
      { id: '1', userId: 'u1', normalizedUrl: 'a', createdAt: new Date('2026-08-31T23:00:00Z') } as never,
      { id: '2', userId: 'u1', normalizedUrl: 'b', createdAt: new Date('2026-09-01T00:00:00Z') } as never,
      { id: '3', userId: 'u1', normalizedUrl: 'c', createdAt: new Date('2026-09-05T00:00:00Z') } as never,
      { id: '4', userId: 'u2', normalizedUrl: 'd', createdAt: new Date('2026-09-05T00:00:00Z') } as never // different user
    )

    expect(FREE_MONTHLY_FILL_LIMIT).toBe(5) // sanity check the constant this quota is calibrated against
    expect(countFillsInWindow('u1', windowStart)).resolves.toBe(2)
  })
})

describe('findRecentFill', () => {
  it('finds a fill for the same (user, normalized URL) within the idempotency window', async () => {
    fillRepo.rows.push({
      id: '1', userId: 'u1', normalizedUrl: 'https://example.com/job',
      createdAt: new Date(Date.now() - 1000),
    } as never)

    const found = await findRecentFill('u1', 'https://example.com/job')
    expect(found?.id).toBe('1')
  })

  it('does not find a fill older than the idempotency window', async () => {
    fillRepo.rows.push({
      id: '1', userId: 'u1', normalizedUrl: 'https://example.com/job',
      createdAt: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS - 1000),
    } as never)

    const found = await findRecentFill('u1', 'https://example.com/job')
    expect(found).toBeNull()
  })

  it('does not find a fill for a different URL', async () => {
    fillRepo.rows.push({
      id: '1', userId: 'u1', normalizedUrl: 'https://example.com/other-job',
      createdAt: new Date(),
    } as never)

    const found = await findRecentFill('u1', 'https://example.com/job')
    expect(found).toBeNull()
  })
})
