import { JobOrigin } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'

const jobListingRepo = createFakeRepo()
const userJobRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { JobListing } = require('../../src/entities/JobListing')
  const { UserJob } = require('../../src/entities/UserJob')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === JobListing) return jobListingRepo
        if (entity === UserJob) return userJobRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

interface FakeExtraction {
  requiredSkills: string[]
  niceToHaveSkills: string[]
  seniorityLevel: string | null
}
const mockExtractJobSkills = jest.fn(async (_description: string): Promise<FakeExtraction> => ({
  requiredSkills: ['Python'],
  niceToHaveSkills: ['Rust'],
  seniorityLevel: 'Senior',
}))
jest.mock('../../src/services/skills/extractJobSkills', () => ({
  extractJobSkills: (...args: unknown[]) => mockExtractJobSkills(...(args as [string])),
  flattenJobSkills: (e: { requiredSkills: string[]; niceToHaveSkills: string[] }) => [...e.requiredSkills, ...e.niceToHaveSkills],
}))

const fakeProviderA = { id: 'fake-a', detect: () => null, fetch: jest.fn(async (..._args: unknown[]) => [] as unknown[]) }
// Board providers (RemoteOK/WeWorkRemotely/Himalayas) return their whole
// feed unfiltered in real life — this fake stands in for that shape, to
// confirm the software-engineering filter applies to them too (2026-09-09
// fix), not just the title-search aggregators.
const fakeBoardProvider = { id: 'fake-board', detect: () => null, fetch: jest.fn(async (..._args: unknown[]) => [] as unknown[]) }
jest.mock('../../src/services/jobs/providers', () => ({
  atsProviders: [],
  remoteBoardProviders: [{ id: 'fake-board', detect: () => null, fetch: (...args: unknown[]) => fakeBoardProvider.fetch(...args) }],
  aggregatorProviders: [{ id: 'fake-a', detect: () => null, fetch: (...args: unknown[]) => fakeProviderA.fetch(...args) }],
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { ensureUserHasJob, discoverJobsGlobally, ingestExternalJobs, JobInput } from '../../src/services/jobs/discoveryService'

const USER_A = 'user-a'
const USER_B = 'user-b'

function baseInput(overrides: Partial<JobInput> = {}): JobInput {
  return {
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Bengaluru',
    url: 'https://example.com/jobs/1',
    description: 'We need a backend engineer skilled in Python.',
    salary: null,
    isRemote: null,
    postedAt: null,
    source: 'pasted',
    ...overrides,
  }
}

beforeEach(() => {
  jobListingRepo.rows.length = 0
  userJobRepo.rows.length = 0
  mockExtractJobSkills.mockClear()
  fakeProviderA.fetch.mockReset().mockResolvedValue([])
  fakeBoardProvider.fetch.mockReset().mockResolvedValue([])
})

describe('ensureUserHasJob', () => {
  it('creates a new JobListing + UserJob and runs Tier A extraction once for a genuinely new posting', async () => {
    const { jobView, isNewListing, isNewToUser } = await ensureUserHasJob(USER_A, baseInput(), JobOrigin.DISCOVERED)

    expect(isNewListing).toBe(true)
    expect(isNewToUser).toBe(true)
    expect(jobListingRepo.rows).toHaveLength(1)
    expect(userJobRepo.rows).toHaveLength(1)
    expect(mockExtractJobSkills).toHaveBeenCalledTimes(1)
    expect(jobView.skills).toEqual(expect.arrayContaining(['Python', 'Rust']))
    expect(jobView.normalizedFields).toMatchObject({ seniorityLevel: 'Senior' })
  })

  it('skips extraction entirely when the job has no description to extract from', async () => {
    const { jobView } = await ensureUserHasJob(USER_A, baseInput({ description: '' }), JobOrigin.DISCOVERED)
    expect(mockExtractJobSkills).not.toHaveBeenCalled()
    expect(jobView.skills).toEqual([])
  })

  it('a second user discovering the same URL attaches to the existing listing without re-extracting', async () => {
    await ensureUserHasJob(USER_A, baseInput(), JobOrigin.DISCOVERED)
    mockExtractJobSkills.mockClear()

    const { isNewListing, isNewToUser, jobView } = await ensureUserHasJob(USER_B, baseInput(), JobOrigin.DISCOVERED)

    expect(isNewListing).toBe(false)
    expect(isNewToUser).toBe(true)
    expect(mockExtractJobSkills).not.toHaveBeenCalled()
    expect(jobListingRepo.rows).toHaveLength(1) // still one shared listing
    expect(userJobRepo.rows).toHaveLength(2) // one UserJob per user
    expect(jobView.skills).toEqual(expect.arrayContaining(['Python', 'Rust'])) // inherited from the shared listing
  })

  it('the same user re-discovering the same URL is a no-op on UserJob (no duplicate row)', async () => {
    await ensureUserHasJob(USER_A, baseInput(), JobOrigin.DISCOVERED)
    const { isNewToUser } = await ensureUserHasJob(USER_A, baseInput(), JobOrigin.DISCOVERED)

    expect(isNewToUser).toBe(false)
    expect(userJobRepo.rows).toHaveLength(1)
  })

  it('refreshes mutable fields on re-discovery but never touches already-extracted skills', async () => {
    await ensureUserHasJob(USER_A, baseInput({ salary: null, isRemote: false }), JobOrigin.DISCOVERED)
    mockExtractJobSkills.mockClear()
    mockExtractJobSkills.mockResolvedValueOnce({ requiredSkills: ['Go'], niceToHaveSkills: [], seniorityLevel: null })

    const { jobView } = await ensureUserHasJob(
      USER_B,
      baseInput({ salary: '10,00,000 - 15,00,000', isRemote: true }),
      JobOrigin.DISCOVERED
    )

    expect(jobView.salary).toBe('10,00,000 - 15,00,000') // mutable field refreshed
    expect(jobView.isRemote).toBe(true)
    expect(jobView.skills).toEqual(expect.arrayContaining(['Python', 'Rust'])) // NOT re-extracted to ['Go']
    expect(mockExtractJobSkills).not.toHaveBeenCalled()
  })

  it('never dedupes a job with no URL — each call creates its own listing', async () => {
    await ensureUserHasJob(USER_A, baseInput({ url: null }), JobOrigin.PASTED)
    await ensureUserHasJob(USER_A, baseInput({ url: null }), JobOrigin.PASTED)

    expect(jobListingRepo.rows).toHaveLength(2)
    expect(userJobRepo.rows).toHaveLength(2)
  })
})

describe('discoverJobsGlobally', () => {
  it('counts a genuinely new listing and a same-run duplicate URL as seen, never touching UserJob', async () => {
    fakeProviderA.fetch.mockResolvedValue([
      { title: 'Backend Engineer', url: 'https://example.com/jobs/1', company: 'Acme' },
      { title: 'Backend Engineer (dup)', url: 'https://example.com/jobs/1', company: 'Acme' }, // same URL, same run
    ])

    const result = await discoverJobsGlobally()

    expect(result.newListings).toBe(1)
    expect(result.seen).toBe(1)
    expect(jobListingRepo.rows).toHaveLength(1)
    expect(userJobRepo.rows).toHaveLength(0) // system-wide discovery never attaches a candidate
  })

  it('a job with no URL at all is always counted as seen, never persisted', async () => {
    fakeProviderA.fetch.mockResolvedValue([{ title: 'Backend Engineer', url: '', company: 'Acme' }])
    const result = await discoverJobsGlobally()
    expect(result.newListings).toBe(0)
    expect(result.seen).toBe(1)
    expect(jobListingRepo.rows).toHaveLength(0)
  })

  it('filters out non-software-engineering listings from board providers, which return their feed unfiltered', async () => {
    // Board providers have no title/query filtering at the source (unlike
    // aggregatorProviders, which only ever query the target-title seed) —
    // this is the actual gate that keeps e.g. "Executive Personal
    // Assistant" postings out of the pool. Neither counts as "seen" —
    // they're excluded before the dedup/persistence logic even runs.
    fakeBoardProvider.fetch.mockResolvedValue([
      { title: 'Executive Personal Assistant to the Founder', url: 'https://example.com/jobs/2', company: 'Acme' },
      { title: 'Backend Engineer', url: 'https://example.com/jobs/3', company: 'Acme' },
    ])

    const result = await discoverJobsGlobally()

    expect(result.newListings).toBe(1)
    expect(jobListingRepo.rows).toHaveLength(1)
    expect(jobListingRepo.rows[0].title).toBe('Backend Engineer')
  })

  it('queries providers using the system-wide target-title seed, not any candidate profile', async () => {
    await discoverJobsGlobally()
    const [entry] = fakeProviderA.fetch.mock.calls[0] as [{ query: { titles: string[] } }]
    expect(entry.query.titles.length).toBeGreaterThan(0)
    expect(typeof entry.query.titles[0]).toBe('string')
  })
})

describe('ingestExternalJobs', () => {
  it('upserts already-normalized jobs through the same filter + dedup path as discoverJobsGlobally', async () => {
    const result = await ingestExternalJobs([
      baseInput({ title: 'Backend Engineer', url: 'https://example.com/jobs/10', source: 'jobspy:naukri' }),
      baseInput({ title: 'Backend Engineer (dup)', url: 'https://example.com/jobs/10', source: 'jobspy:naukri' }), // same URL, same run
    ])

    expect(result.newListings).toBe(1)
    expect(result.seen).toBe(1)
    expect(result.filteredOut).toBe(0)
    expect(jobListingRepo.rows).toHaveLength(1)
    expect(userJobRepo.rows).toHaveLength(0) // shared pool only, never attaches a candidate
  })

  it('applies the same software-engineering-role filter as every other source', async () => {
    const result = await ingestExternalJobs([
      baseInput({ title: 'Executive Personal Assistant to the Founder', url: 'https://example.com/jobs/11' }),
      baseInput({ title: 'Backend Engineer', url: 'https://example.com/jobs/12' }),
    ])

    expect(result.newListings).toBe(1)
    expect(result.filteredOut).toBe(1)
    expect(jobListingRepo.rows).toHaveLength(1)
    expect(jobListingRepo.rows[0].title).toBe('Backend Engineer')
  })

  it('uses preExtractedSkills directly and skips the LLM extraction call when present', async () => {
    const result = await ingestExternalJobs([
      baseInput({
        url: 'https://example.com/jobs/13',
        source: 'jobspy:naukri',
        preExtractedSkills: ['Java', 'Spring Boot'],
      }),
    ])

    expect(result.newListings).toBe(1)
    expect(mockExtractJobSkills).not.toHaveBeenCalled()
    expect(jobListingRepo.rows[0].skills).toEqual(['Java', 'Spring Boot'])
  })

  it('falls back to LLM extraction when preExtractedSkills is absent', async () => {
    const result = await ingestExternalJobs([baseInput({ url: 'https://example.com/jobs/14', source: 'jobspy:indeed' })])

    expect(result.newListings).toBe(1)
    expect(mockExtractJobSkills).toHaveBeenCalledTimes(1)
    expect(jobListingRepo.rows[0].skills).toEqual(expect.arrayContaining(['Python', 'Rust']))
  })
})
