import { JobListingStatus } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'

type FakeListing = {
  id: string
  status: JobListingStatus
  url: string | null
  lastLinkCheckedAt: Date | null
  linkCheckFailureCount: number
  expiredAt: Date | null
}

const jobListingRepo = createFakeRepo<FakeListing>()

jest.mock('../../src/config/dataSource', () => ({
  AppDataSource: { getRepository: jest.fn(() => jobListingRepo) },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import {
  runLinkHealthCheck,
  BATCH_SIZE,
  AMBIGUOUS_FAILURE_THRESHOLD,
} from '../../src/services/jobs/linkHealthCheck'

function listing(overrides: Partial<FakeListing> & { id: string; url: string }): FakeListing {
  return {
    status: JobListingStatus.ACTIVE,
    lastLinkCheckedAt: null,
    linkCheckFailureCount: 0,
    expiredAt: null,
    ...overrides,
  }
}

function mockFetchResponses(byUrl: Record<string, { status: number } | Error>) {
  ;(global.fetch as jest.Mock) = jest.fn(async (url: string) => {
    const outcome = byUrl[url]
    if (outcome instanceof Error) throw outcome
    return { status: outcome.status, ok: outcome.status >= 200 && outcome.status < 300 } as Response
  })
}

beforeEach(() => {
  jobListingRepo.rows.length = 0
})

describe('runLinkHealthCheck — batch selection', () => {
  it('only checks ACTIVE listings that have a URL', async () => {
    jobListingRepo.rows.push(
      listing({ id: 'active-with-url', url: 'https://a.example.com/job/1' }),
      { ...listing({ id: 'no-url', url: 'https://unused.example.com' }), url: null },
      { ...listing({ id: 'expired', url: 'https://b.example.com/job/2' }), status: JobListingStatus.EXPIRED }
    )
    mockFetchResponses({ 'https://a.example.com/job/1': { status: 200 } })

    const summary = await runLinkHealthCheck()

    expect(summary.checked).toBe(1)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('checks never-checked (null lastLinkCheckedAt) listings before already-checked ones', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    jobListingRepo.rows.push(
      listing({ id: 'checked-before', url: 'https://a.example.com/job/1', lastLinkCheckedAt: oneHourAgo }),
      listing({ id: 'never-checked', url: 'https://b.example.com/job/2', lastLinkCheckedAt: null })
    )
    const calledOrder: string[] = []
    ;(global.fetch as jest.Mock) = jest.fn(async (url: string) => {
      calledOrder.push(url)
      return { status: 200, ok: true } as Response
    })

    await runLinkHealthCheck()

    expect(calledOrder[0]).toBe('https://b.example.com/job/2') // never-checked goes first
  })

  it('caps a run at BATCH_SIZE listings', async () => {
    for (let i = 0; i < BATCH_SIZE + 10; i++) {
      jobListingRepo.rows.push(listing({ id: `l${i}`, url: `https://site${i}.example.com/job` }))
    }
    ;(global.fetch as jest.Mock) = jest.fn(async () => ({ status: 200, ok: true } as Response))

    const summary = await runLinkHealthCheck()

    expect(summary.checked).toBe(BATCH_SIZE)
  })
})

describe('runLinkHealthCheck — outcome handling', () => {
  it('resets the failure count and leaves a healthy (2xx) listing ACTIVE', async () => {
    jobListingRepo.rows.push(listing({ id: 'ok', url: 'https://a.example.com/job/1', linkCheckFailureCount: 1 }))
    mockFetchResponses({ 'https://a.example.com/job/1': { status: 200 } })

    const summary = await runLinkHealthCheck()

    const row = jobListingRepo.rows[0]
    expect(row.status).toBe(JobListingStatus.ACTIVE)
    expect(row.linkCheckFailureCount).toBe(0)
    expect(row.lastLinkCheckedAt).not.toBeNull()
    expect(summary.stillHealthy).toBe(1)
    expect(summary.markedExpired).toBe(0)
  })

  it('immediately expires a listing on a clean 404, with no need for a second failure', async () => {
    jobListingRepo.rows.push(listing({ id: 'dead', url: 'https://a.example.com/job/1' }))
    mockFetchResponses({ 'https://a.example.com/job/1': { status: 404 } })

    const summary = await runLinkHealthCheck()

    const row = jobListingRepo.rows[0]
    expect(row.status).toBe(JobListingStatus.EXPIRED)
    expect(row.expiredAt).not.toBeNull()
    expect(summary.markedExpired).toBe(1)
  })

  it('immediately expires a listing on a clean 410 (Gone)', async () => {
    jobListingRepo.rows.push(listing({ id: 'gone', url: 'https://a.example.com/job/1' }))
    mockFetchResponses({ 'https://a.example.com/job/1': { status: 410 } })

    await runLinkHealthCheck()

    expect(jobListingRepo.rows[0].status).toBe(JobListingStatus.EXPIRED)
  })

  it('does not expire on the first ambiguous failure (e.g. 403) — just counts it', async () => {
    jobListingRepo.rows.push(listing({ id: 'blocked-once', url: 'https://a.example.com/job/1' }))
    mockFetchResponses({ 'https://a.example.com/job/1': { status: 403 } })

    const summary = await runLinkHealthCheck()

    const row = jobListingRepo.rows[0]
    expect(row.status).toBe(JobListingStatus.ACTIVE)
    expect(row.linkCheckFailureCount).toBe(1)
    expect(summary.ambiguousFailures).toBe(1)
    expect(summary.markedExpired).toBe(0)
  })

  it(`expires after ${AMBIGUOUS_FAILURE_THRESHOLD} consecutive ambiguous failures across separate runs`, async () => {
    jobListingRepo.rows.push(
      listing({ id: 'blocked-twice', url: 'https://a.example.com/job/1', linkCheckFailureCount: AMBIGUOUS_FAILURE_THRESHOLD - 1 })
    )
    mockFetchResponses({ 'https://a.example.com/job/1': { status: 403 } })

    const summary = await runLinkHealthCheck()

    const row = jobListingRepo.rows[0]
    expect(row.status).toBe(JobListingStatus.EXPIRED)
    expect(row.expiredAt).not.toBeNull()
    expect(summary.markedExpired).toBe(1)
  })

  it('treats a network error/timeout as an ambiguous failure, not a confirmed-dead one', async () => {
    jobListingRepo.rows.push(listing({ id: 'timeout', url: 'https://a.example.com/job/1' }))
    mockFetchResponses({ 'https://a.example.com/job/1': new Error('timeout') })

    const summary = await runLinkHealthCheck()

    const row = jobListingRepo.rows[0]
    expect(row.status).toBe(JobListingStatus.ACTIVE)
    expect(row.linkCheckFailureCount).toBe(1)
    expect(summary.ambiguousFailures).toBe(1)
  })

  it('falls back to GET when a site responds 405 to HEAD', async () => {
    const calls: string[] = []
    ;(global.fetch as jest.Mock) = jest.fn(async (_url: string, opts: RequestInit) => {
      calls.push(opts.method as string)
      if (opts.method === 'HEAD') return { status: 405, ok: false } as Response
      return { status: 200, ok: true } as Response
    })
    jobListingRepo.rows.push(listing({ id: 'head-rejected', url: 'https://a.example.com/job/1' }))

    const summary = await runLinkHealthCheck()

    expect(calls).toEqual(['HEAD', 'GET'])
    expect(jobListingRepo.rows[0].status).toBe(JobListingStatus.ACTIVE)
    expect(summary.stillHealthy).toBe(1)
  })
})
