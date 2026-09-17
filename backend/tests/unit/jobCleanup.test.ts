import { JobListingStatus } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'

const jobListingRepo = createFakeRepo<{
  id: string
  status: JobListingStatus
  firstSeenAt: Date
  expiredAt: Date | null
}>()

jest.mock('../../src/config/dataSource', () => ({
  AppDataSource: { getRepository: jest.fn(() => jobListingRepo) },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { expireStaleJobs, purgeExpiredJobs, STALE_AFTER_DAYS, PURGE_AFTER_EXPIRED_DAYS, CLEANUP_STARTS_AT } from '../../src/services/jobs/jobCleanup'

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

beforeEach(() => {
  jobListingRepo.rows.length = 0
})

describe('expireStaleJobs', () => {
  it('marks ACTIVE listings older than STALE_AFTER_DAYS as EXPIRED and stamps expiredAt', async () => {
    jobListingRepo.rows.push(
      { id: 'old', status: JobListingStatus.ACTIVE, firstSeenAt: daysAgo(STALE_AFTER_DAYS + 5), expiredAt: null },
      { id: 'exactly-at-threshold', status: JobListingStatus.ACTIVE, firstSeenAt: daysAgo(STALE_AFTER_DAYS), expiredAt: null }
    )

    const marked = await expireStaleJobs()

    expect(marked).toBe(2)
    const old = jobListingRepo.rows.find((r) => r.id === 'old')!
    expect(old.status).toBe(JobListingStatus.EXPIRED)
    expect(old.expiredAt).not.toBeNull()
  })

  it('leaves ACTIVE listings younger than STALE_AFTER_DAYS untouched', async () => {
    jobListingRepo.rows.push({ id: 'fresh', status: JobListingStatus.ACTIVE, firstSeenAt: daysAgo(1), expiredAt: null })

    const marked = await expireStaleJobs()

    expect(marked).toBe(0)
    expect(jobListingRepo.rows[0].status).toBe(JobListingStatus.ACTIVE)
  })

  it('never touches a listing that is already EXPIRED', async () => {
    const alreadyExpiredAt = daysAgo(100)
    jobListingRepo.rows.push({
      id: 'already-expired',
      status: JobListingStatus.EXPIRED,
      firstSeenAt: daysAgo(STALE_AFTER_DAYS + 50),
      expiredAt: alreadyExpiredAt,
    })

    const marked = await expireStaleJobs()

    expect(marked).toBe(0)
    expect(jobListingRepo.rows[0].expiredAt).toBe(alreadyExpiredAt)
  })
})

describe('purgeExpiredJobs', () => {
  const realNow = Date.now

  afterEach(() => {
    Date.now = realNow
  })

  it('is a no-op before CLEANUP_STARTS_AT, even with long-EXPIRED listings present', async () => {
    Date.now = () => new Date('2026-09-17T00:00:00Z').getTime()
    expect(Date.now()).toBeLessThan(CLEANUP_STARTS_AT.getTime())

    jobListingRepo.rows.push({
      id: 'long-expired',
      status: JobListingStatus.EXPIRED,
      firstSeenAt: daysAgo(200),
      expiredAt: daysAgo(PURGE_AFTER_EXPIRED_DAYS + 30),
    })

    const deleted = await purgeExpiredJobs()

    expect(deleted).toBe(0)
    expect(jobListingRepo.rows).toHaveLength(1)
  })

  it('deletes EXPIRED listings past PURGE_AFTER_EXPIRED_DAYS once on/after CLEANUP_STARTS_AT', async () => {
    Date.now = () => CLEANUP_STARTS_AT.getTime() + 24 * 60 * 60 * 1000

    jobListingRepo.rows.push(
      { id: 'ripe', status: JobListingStatus.EXPIRED, firstSeenAt: daysAgo(200), expiredAt: daysAgo(PURGE_AFTER_EXPIRED_DAYS + 1) },
      { id: 'too-recent', status: JobListingStatus.EXPIRED, firstSeenAt: daysAgo(70), expiredAt: daysAgo(2) },
      { id: 'still-active', status: JobListingStatus.ACTIVE, firstSeenAt: daysAgo(1), expiredAt: null }
    )

    const deleted = await purgeExpiredJobs()

    expect(deleted).toBe(1)
    expect(jobListingRepo.rows.map((r) => r.id).sort()).toEqual(['still-active', 'too-recent'])
  })
})
