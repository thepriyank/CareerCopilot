import { JobOrigin, RemotePreference, SearchUrgency } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'

const listingRepo = createFakeRepo()
const userJobRepo = createFakeRepo()
const matchRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { JobListing } = require('../../src/entities/JobListing')
  const { UserJob } = require('../../src/entities/UserJob')
  const { MatchResult } = require('../../src/entities/MatchResult')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === JobListing) return listingRepo
        if (entity === UserJob) return userJobRepo
        if (entity === MatchResult) return matchRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { ensureMatchedJobsForCandidate, recomputeMatchesForCandidate } from '../../src/services/matching/surfaceJobs'
import { CandidateProfile } from '../../src/entities/CandidateProfile'

const USER_ID = 'user-1'

function baseProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'profile-1',
    userId: USER_ID,
    targetRoles: [],
    industries: [],
    locations: [],
    remotePreference: RemotePreference.OPEN,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'USD',
    urgency: SearchUrgency.ACTIVELY_LOOKING,
    noticePeriod: null,
    visaStatus: null,
    summary: null,
    avoidTechnologies: [],
    completionScore: 100,
    onboardingState: 'DONE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CandidateProfile
}

function baseListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    title: 'Backend Engineer',
    description: 'We need a backend engineer skilled in Python.',
    skills: ['Python'],
    normalizedFields: { requiredSkills: ['Python'], niceToHaveSkills: [] },
    isRemote: null,
    location: null,
    salary: null,
    lastSeenAt: new Date(),
    ...overrides,
  }
}

const masterResume = { content: { skills: [{ id: '1', name: 'Python' }] } }

beforeEach(() => {
  listingRepo.rows.length = 0
  userJobRepo.rows.length = 0
  matchRepo.rows.length = 0
})

describe('ensureMatchedJobsForCandidate — avoided-technology exclusion', () => {
  it('never attaches a listing whose required skills include an avoided technology', async () => {
    listingRepo.rows.push(baseListing({ normalizedFields: { requiredSkills: ['Python', 'Java'] } }) as never)
    const profile = baseProfile({ avoidTechnologies: ['Java'] })

    const result = await ensureMatchedJobsForCandidate(USER_ID, profile, masterResume as never)

    expect(result.newlyMatched).toBe(0)
    expect(userJobRepo.rows).toHaveLength(0)
    expect(matchRepo.rows).toHaveLength(0)
  })

  it('still attaches a listing where the avoided technology is only nice-to-have, not required', async () => {
    listingRepo.rows.push(
      baseListing({ normalizedFields: { requiredSkills: ['Python'], niceToHaveSkills: ['Java'] } }) as never
    )
    const profile = baseProfile({ avoidTechnologies: ['Java'] })

    const result = await ensureMatchedJobsForCandidate(USER_ID, profile, masterResume as never)

    expect(result.newlyMatched).toBe(1)
    expect(userJobRepo.rows).toHaveLength(1)
  })

  it('attaches normally when the candidate has no avoid list', async () => {
    listingRepo.rows.push(baseListing() as never)
    const profile = baseProfile({ avoidTechnologies: [] })

    const result = await ensureMatchedJobsForCandidate(USER_ID, profile, masterResume as never)

    expect(result.newlyMatched).toBe(1)
  })

  it('applies the exclusion even with a null profile look-up guarded correctly (no avoid list to apply)', async () => {
    listingRepo.rows.push(baseListing() as never)

    const result = await ensureMatchedJobsForCandidate(USER_ID, null, masterResume as never)

    expect(result.newlyMatched).toBe(1)
  })

  it('excludes based on JobOrigin.MATCHED attachment path only — a listing already attached is left alone regardless of avoid list', async () => {
    listingRepo.rows.push(baseListing({ normalizedFields: { requiredSkills: ['Java'] } }) as never)
    userJobRepo.rows.push({ id: 'uj-1', userId: USER_ID, jobListingId: 'listing-1', origin: JobOrigin.PASTED } as never)
    const profile = baseProfile({ avoidTechnologies: ['Java'] })

    const result = await ensureMatchedJobsForCandidate(USER_ID, profile, masterResume as never)

    expect(result.newlyMatched).toBe(0) // already attached, not re-evaluated — not a new exclusion decision
    expect(userJobRepo.rows).toHaveLength(1) // the pre-existing pasted job stays, untouched
  })
})

describe('recomputeMatchesForCandidate', () => {
  it("creates a fresh MatchResult for every job already on the candidate's list", async () => {
    userJobRepo.rows.push({ id: 'uj-1', userId: USER_ID, jobListingId: 'listing-1', origin: JobOrigin.MATCHED, jobListing: baseListing() } as never)
    userJobRepo.rows.push({
      id: 'uj-2',
      userId: USER_ID,
      jobListingId: 'listing-2',
      origin: JobOrigin.MATCHED,
      jobListing: baseListing({ id: 'listing-2', skills: ['Go'] }),
    } as never)

    const result = await recomputeMatchesForCandidate(USER_ID, baseProfile(), masterResume as never)

    expect(result.recomputed).toBe(2)
    expect(matchRepo.rows).toHaveLength(2)
    expect(matchRepo.rows.map((r: any) => r.jobId).sort()).toEqual(['uj-1', 'uj-2'])
  })

  it('skips a UserJob with no jobListing relation loaded rather than crashing', async () => {
    userJobRepo.rows.push({ id: 'uj-1', userId: USER_ID, jobListingId: 'listing-1', origin: JobOrigin.MATCHED } as never)

    const result = await recomputeMatchesForCandidate(USER_ID, baseProfile(), masterResume as never)

    expect(result.recomputed).toBe(0)
    expect(matchRepo.rows).toHaveLength(0)
  })

  it("only recomputes for the given user, not other candidates' jobs", async () => {
    userJobRepo.rows.push({ id: 'uj-1', userId: USER_ID, jobListingId: 'listing-1', origin: JobOrigin.MATCHED, jobListing: baseListing() } as never)
    userJobRepo.rows.push({ id: 'uj-2', userId: 'other-user', jobListingId: 'listing-1', origin: JobOrigin.MATCHED, jobListing: baseListing() } as never)

    const result = await recomputeMatchesForCandidate(USER_ID, baseProfile(), masterResume as never)

    expect(result.recomputed).toBe(1)
    expect(matchRepo.rows).toHaveLength(1)
    expect((matchRepo.rows[0] as { userId: string }).userId).toBe(USER_ID)
  })

  it('reflects a newly-added résumé skill in the fresh score — the whole point of this function', async () => {
    userJobRepo.rows.push({
      id: 'uj-1',
      userId: USER_ID,
      jobListingId: 'listing-1',
      origin: JobOrigin.MATCHED,
      jobListing: baseListing({ skills: ['Python', 'Go'] }),
    } as never)
    const resumeWithGo = { content: { skills: [{ id: '1', name: 'Python' }, { id: '2', name: 'Go' }] } }

    const result = await recomputeMatchesForCandidate(USER_ID, baseProfile(), resumeWithGo as never)

    expect(result.recomputed).toBe(1)
    const rationale = (matchRepo.rows[0] as { rationale: { matchedSkills: string[]; missingSkills: string[] } }).rationale
    expect(rationale.matchedSkills).toEqual(expect.arrayContaining(['Python', 'Go']))
    expect(rationale.missingSkills).toEqual([])
  })
})
