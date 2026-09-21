import type { JobView } from '../../src/services/jobs/jobView'

const mockListJobViews = jest.fn<Promise<JobView[]>, [string]>()
jest.mock('../../src/services/jobs/jobView', () => ({
  listJobViews: (...args: [string]) => mockListJobViews(...args),
}))

import { resolveJobForUrl } from '../../src/services/extension/resolveJob'

function job(overrides: Partial<JobView>): JobView {
  return {
    id: 'uj-1', userId: 'u1', jobListingId: 'jl-1', source: 'manual', url: null,
    title: 'Backend Engineer', company: 'Acme', location: null, salary: null,
    salaryMin: null, salaryMax: null, salaryCurrency: null,
    minYearsExperience: null, maxYearsExperience: null,
    description: '', normalizedFields: {}, skills: [], experienceLevel: null,
    isRemote: null, createdAt: new Date(), matchScore: null, appliedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  mockListJobViews.mockReset()
})

describe('resolveJobForUrl', () => {
  it('matches an exact URL', async () => {
    const acme = job({ id: 'uj-1', url: 'https://boards.greenhouse.io/acme/jobs/123' })
    mockListJobViews.mockResolvedValue([acme])

    const { job: found, candidates } = await resolveJobForUrl('u1', 'https://boards.greenhouse.io/acme/jobs/123')
    expect(found?.id).toBe('uj-1')
    expect(candidates).toEqual([])
  })

  it('matches after normalizing tracking params/trailing slash/case', async () => {
    const acme = job({ id: 'uj-1', url: 'https://boards.greenhouse.io/acme/jobs/123/' })
    mockListJobViews.mockResolvedValue([acme])

    const { job: found } = await resolveJobForUrl('u1', 'HTTPS://boards.greenhouse.io/acme/jobs/123?utm_source=li')
    expect(found?.id).toBe('uj-1')
  })

  it('returns no job and a candidate shortlist when nothing matches', async () => {
    const jobs = [job({ id: 'uj-1', url: 'https://a.com/1' }), job({ id: 'uj-2', url: 'https://b.com/2' })]
    mockListJobViews.mockResolvedValue(jobs)

    const { job: found, candidates } = await resolveJobForUrl('u1', 'https://c.com/3')
    expect(found).toBeNull()
    expect(candidates.map((c) => c.id)).toEqual(['uj-1', 'uj-2'])
  })

  it('degrades to no match (never throws) when the user has no jobs at all', async () => {
    mockListJobViews.mockResolvedValue([])
    const { job: found, candidates } = await resolveJobForUrl('u1', 'https://c.com/3')
    expect(found).toBeNull()
    expect(candidates).toEqual([])
  })

  it('caps the candidate shortlist at 20', async () => {
    const jobs = Array.from({ length: 30 }, (_, i) => job({ id: `uj-${i}`, url: `https://a.com/${i}` }))
    mockListJobViews.mockResolvedValue(jobs)

    const { candidates } = await resolveJobForUrl('u1', 'https://nomatch.com')
    expect(candidates).toHaveLength(20)
  })
})
