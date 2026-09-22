import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { GeneratedResumeVersion } from '../../src/entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../src/entities/GeneratedCoverLetter'
import { SkillGapReport } from '../../src/entities/SkillGapReport'
import { MatchResult } from '../../src/entities/MatchResult'
import { CandidateProfile } from '../../src/entities/CandidateProfile'
import { ResumeVersionType, ArtifactStatus, Plan } from '../../src/entities/enums'
import { extractJdSkills } from '../../src/services/skills/jdSkillGap'
import { createFakeRepo } from './testUtils/fakeRepo'

const jobListingRepo = createFakeRepo()
const userJobRepo = createFakeRepo()
const resumeRepo = createFakeRepo()
const skillGapRepo = createFakeRepo()
const profileRepo = createFakeRepo()
const coverLetterRepo = createFakeRepo()
const matchResultRepo = createFakeRepo()
const userRepo = createFakeRepo()

// The real UserJob repo joins to JobListing via TypeORM `relations` —
// fakeRepo has no concept of relations, so `find`/`findOne`/`findOneBy` are
// overridden here to attach `.jobListing` by hand, the way TypeORM would.
function matchesWhere(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true
  return Object.entries(where).every(([k, v]) => row[k] === v)
}
function withJobListing(row: any) {
  return { ...row, jobListing: jobListingRepo.rows.find((jl: any) => jl.id === row.jobListingId) }
}
userJobRepo.find = jest.fn(async (options?: { where?: Record<string, unknown>; order?: { createdAt?: 'ASC' | 'DESC' } }) => {
  let rows = userJobRepo.rows.filter((r: any) => matchesWhere(r, options?.where)).map(withJobListing)
  if (options?.order?.createdAt === 'DESC') rows = [...rows].sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
  return rows
}) as never
userJobRepo.findOne = jest.fn(async (options: { where?: Record<string, unknown> }) => {
  const row = userJobRepo.rows.find((r: any) => matchesWhere(r, options?.where))
  return row ? withJobListing(row) : null
}) as never

jest.mock('../../src/config/dataSource', () => {
  // Requiring inside the factory keeps this file the single source of truth
  // for which entity class maps to which fake repo, without hoisting issues.
  const { JobListing } = require('../../src/entities/JobListing')
  const { UserJob } = require('../../src/entities/UserJob')
  const { GeneratedResumeVersion } = require('../../src/entities/GeneratedResumeVersion')
  const { GeneratedCoverLetter } = require('../../src/entities/GeneratedCoverLetter')
  const { SkillGapReport } = require('../../src/entities/SkillGapReport')
  const { MatchResult } = require('../../src/entities/MatchResult')
  const { CandidateProfile } = require('../../src/entities/CandidateProfile')
  const { User } = require('../../src/entities/User')

  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === JobListing) return jobListingRepo
        if (entity === UserJob) return userJobRepo
        if (entity === GeneratedResumeVersion) return resumeRepo
        if (entity === GeneratedCoverLetter) return coverLetterRepo
        if (entity === SkillGapReport) return skillGapRepo
        if (entity === MatchResult) return matchResultRepo
        if (entity === CandidateProfile) return profileRepo
        if (entity === User) return userRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// Tier A's LLM skill extraction is mocked at its own module boundary (same
// pattern as coverLetterGenerator/resumeTailorer below) rather than letting
// it reach the real LLM chain. Delegating to the real regex extractor keeps
// this deterministic/offline while extracting the exact same skills the
// pre-Tier-A tests already asserted on for these fixtures.
const mockExtractJobSkills = jest.fn(async (description: string) => ({
  requiredSkills: extractJdSkills(description),
  niceToHaveSkills: [] as string[],
  seniorityLevel: null as string | null,
}))
jest.mock('../../src/services/skills/extractJobSkills', () => ({
  extractJobSkills: (...args: unknown[]) => mockExtractJobSkills(...(args as [string])),
  flattenJobSkills: (e: { requiredSkills: string[]; niceToHaveSkills: string[] }) => [...e.requiredSkills, ...e.niceToHaveSkills],
}))

const mockGenerateCoverLetter = jest.fn(async (job: { title: string; company: string | null }) => ({
  candidate: { name: 'Priya Sharma', email: 'priya@example.com' },
  letter: {
    role_title: job.title,
    company: job.company ?? undefined,
    opening: 'Opening line.',
    profile_intro: 'Intro line.',
    achievements: [{ lead: 'Cut latency', impact: '40% improvement' }],
  },
}))
jest.mock('../../src/services/ai/coverLetterGenerator', () => ({
  generateCoverLetter: (...args: unknown[]) => mockGenerateCoverLetter(...(args as [any])),
}))

const mockTailorResume = jest.fn(async (entities: { summary?: string }) => ({
  ...entities,
  summary: 'Tailored: ' + (entities.summary ?? ''),
}))
jest.mock('../../src/services/ai/resumeTailorer', () => ({
  tailorResume: (...args: unknown[]) => mockTailorResume(...(args as [any])),
}))

// Playwright rendering is already verified end-to-end manually (see the PDF
// export work) — route tests here only need to confirm the route calls
// through correctly and streams a PDF response, not re-launch a browser.
const mockRenderHtmlToPdf = jest.fn(async (..._args: unknown[]) => Buffer.from('%PDF-fake'))
jest.mock('../../src/services/documents/renderPdf', () => ({
  renderHtmlToPdf: (...args: unknown[]) => mockRenderHtmlToPdf(...(args as [any])),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import jobsRoutes from '../../src/routes/jobs.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/jobs', jobsRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  jobListingRepo.rows.length = 0
  userJobRepo.rows.length = 0
  resumeRepo.rows.length = 0
  skillGapRepo.rows.length = 0
  profileRepo.rows.length = 0
  coverLetterRepo.rows.length = 0
  matchResultRepo.rows.length = 0
  userRepo.rows.length = 0
  // PREMIUM by default — these tests aren't about the free-tier quota (see
  // the dedicated 'free-tier quota' describe block below for that), so
  // every other test keeps its pre-existing "unlimited" assumption.
  userRepo.rows.push(
    { id: USER_ID, plan: Plan.PREMIUM, planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), createdAt: new Date('2026-01-01') },
    { id: OTHER_USER_ID, plan: Plan.PREMIUM, planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), createdAt: new Date('2026-01-01') }
  )
  mockExtractJobSkills.mockClear()
  mockGenerateCoverLetter.mockClear()
  mockTailorResume.mockClear()
  mockRenderHtmlToPdf.mockClear()
})

async function seedJobAndMasterResume(app: express.Express, authToken: string) {
  const created = await request(app)
    .post('/api/jobs')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ title: 'Backend Engineer', company: 'Acme', description: '## Requirements\n- Python\n- Kubernetes\n- Rust\n' })

  const masterResume = resumeRepo.create({
    userId: USER_ID,
    type: ResumeVersionType.MASTER,
    status: ArtifactStatus.DRAFT,
    content: {
      contact: { name: 'Priya Sharma', email: 'priya@example.com' },
      summary: 'Backend engineer.',
      experience: [{ title: 'Engineer', company: 'Acme', bullets: ['Deployed services onto Kubernetes.'] }],
      skills: [{ name: 'Python' }],
      projects: [],
    },
    createdAt: new Date(),
  })
  await resumeRepo.save(masterResume)

  return created.body.job
}

describe('POST /api/jobs', () => {
  it('rejects unauthenticated requests', async () => {
    const app = buildApp()
    const res = await request(app).post('/api/jobs').send({ title: 'x', description: 'y' })
    expect(res.status).toBe(401)
  })

  it('creates a job posting scoped to the caller and classifies its tier', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Senior Backend Engineer',
        company: 'Acme',
        location: 'Bengaluru',
        description: 'Build things.',
      })

    expect(res.status).toBe(201)
    expect(res.body.job.userId).toBe(USER_ID)
    expect(res.body.job.source).toBe('pasted')
    expect(res.body.job.experienceLevel).toBe('senior')
  })

  it('rejects a payload missing the required description', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Engineer' })
    expect(res.status).toBe(400)
  })

  it('extracts and persists skills onto the new JobListing via Tier A', async () => {
    const app = buildApp()
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', description: '## Requirements\n- Python\n- Kubernetes\n' })

    expect(mockExtractJobSkills).toHaveBeenCalledTimes(1)
    expect(res.body.job.skills).toEqual(expect.arrayContaining(['Python', 'Kubernetes']))
  })

  it('pasting the same URL twice attaches the caller to the existing listing instead of duplicating it', async () => {
    const app = buildApp()
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', url: 'https://example.com/job-1', description: 'desc one' })
    const second = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', url: 'https://example.com/job-1', description: 'desc two' })

    expect(jobListingRepo.rows).toHaveLength(1)
    expect(userJobRepo.rows).toHaveLength(1)
    expect(second.body.job.id).toBe(userJobRepo.rows[0].id)
  })
})

describe('GET /api/jobs', () => {
  it("only returns the caller's own job postings", async () => {
    const app = buildApp()
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const otherToken = signToken(OTHER_USER_ID, 'FREE')
    await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Not mine', description: 'desc' })

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.jobs).toHaveLength(1)
    expect(res.body.jobs[0].title).toBe('Mine')
  })
})

describe('GET /api/jobs/:id', () => {
  it('404s for a job posting that does not belong to the caller', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const otherToken = signToken(OTHER_USER_ID, 'FREE')
    const res = await request(app)
      .get(`/api/jobs/${created.body.job.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/jobs/:id/applied', () => {
  it('rejects a job posting that does not belong to the caller', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const otherToken = signToken(OTHER_USER_ID, 'FREE')
    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/applied`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ applied: true })
    expect(res.status).toBe(404)
  })

  it('marks a job as applied, setting a timestamp', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })
    expect(created.body.job.appliedAt).toBeNull()

    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/applied`)
      .set('Authorization', `Bearer ${token}`)
      .send({ applied: true })

    expect(res.status).toBe(200)
    expect(res.body.job.appliedAt).not.toBeNull()
  })

  it('unmarks a job as applied, clearing the timestamp', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })
    await request(app)
      .put(`/api/jobs/${created.body.job.id}/applied`)
      .set('Authorization', `Bearer ${token}`)
      .send({ applied: true })

    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/applied`)
      .set('Authorization', `Bearer ${token}`)
      .send({ applied: false })

    expect(res.status).toBe(200)
    expect(res.body.job.appliedAt).toBeNull()
  })

  it('rejects a payload missing the required "applied" boolean', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/applied`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/jobs/:id/not-interested', () => {
  it('rejects a job posting that does not belong to the caller', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const otherToken = signToken(OTHER_USER_ID, 'FREE')
    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ reason: 'ROLE_TOO_JUNIOR' })
    expect(res.status).toBe(404)
  })

  it('marks a job not interested with a structured reason and optional note, setting a timestamp', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Junior Data Engineer', description: 'desc' })
    expect(created.body.job.notInterestedAt).toBeNull()

    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'ROLE_TOO_JUNIOR', note: 'I have 10 years of experience, this is an entry-level role' })

    expect(res.status).toBe(200)
    expect(res.body.job.notInterestedAt).not.toBeNull()
    expect(res.body.job.notInterestedReason).toBe('ROLE_TOO_JUNIOR')
    expect(res.body.job.notInterestedNote).toBe('I have 10 years of experience, this is an entry-level role')
  })

  it('rejects an unrecognized reason value', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const res = await request(app)
      .put(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'NOT_A_REAL_REASON' })
    expect(res.status).toBe(400)
  })

  it('excludes a not-interested job from GET /api/jobs by default, but includes it with ?includeNotInterested=true', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Junior Data Engineer', description: 'desc' })
    await request(app)
      .put(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'ROLE_TOO_JUNIOR' })

    const hidden = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)
    expect(hidden.body.jobs).toHaveLength(0)

    const shown = await request(app).get('/api/jobs?includeNotInterested=true').set('Authorization', `Bearer ${token}`)
    expect(shown.body.jobs).toHaveLength(1)
    expect(shown.body.jobs[0].notInterestedReason).toBe('ROLE_TOO_JUNIOR')
  })
})

describe('DELETE /api/jobs/:id/not-interested', () => {
  it('undoes a not-interested dismissal, clearing all three fields', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Junior Data Engineer', description: 'desc' })
    await request(app)
      .put(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'SALARY_TOO_LOW', note: 'pays too little' })

    const res = await request(app)
      .delete(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.job.notInterestedAt).toBeNull()
    expect(res.body.job.notInterestedReason).toBeNull()
    expect(res.body.job.notInterestedNote).toBeNull()

    const list = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)
    expect(list.body.jobs).toHaveLength(1)
  })

  it('rejects a job posting that does not belong to the caller', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Mine', description: 'desc' })

    const otherToken = signToken(OTHER_USER_ID, 'FREE')
    const res = await request(app)
      .delete(`/api/jobs/${created.body.job.id}/not-interested`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/jobs/:id/skill-gap', () => {
  it('requires a master resume to exist first', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Backend Engineer',
        description: '## Requirements\n- Python\n- Kubernetes\n',
      })

    const res = await request(app)
      .post(`/api/jobs/${created.body.job.id}/skill-gap`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NO_MASTER_RESUME')
  })

  it('classifies the AI-extracted job skills against the master resume and persists a SkillGapReport', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Backend Engineer',
        description: '## Requirements\n- Python\n- Kubernetes\n- Rust\n',
      })

    const masterResume = resumeRepo.create({
      userId: USER_ID,
      type: ResumeVersionType.MASTER,
      status: ArtifactStatus.DRAFT,
      content: {
        summary: 'Backend engineer.',
        experience: [{ title: 'Engineer', company: 'Acme', bullets: ['Deployed services onto Kubernetes.'] }],
        skills: [{ name: 'Python' }],
        projects: [],
      },
      createdAt: new Date(),
    })
    await resumeRepo.save(masterResume)

    const res = await request(app)
      .post(`/api/jobs/${created.body.job.id}/skill-gap`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(res.body.existing).toContain('Python')
    expect(res.body.supportedByResume).toContain('Kubernetes')
    expect(res.body.skillGapReport.missingSkills).toContain('Rust')
    expect(skillGapRepo.rows).toHaveLength(1)
  })
})

describe('GET /api/jobs/:id/skill-gap', () => {
  it('returns null (not a 404) when no skill-gap report has been computed yet', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    const res = await request(app).get(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.skillGapReport).toBeNull()
    expect(res.body.existing).toEqual([])
  })

  it('returns the persisted three-bucket classification after computing it once', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.skillGapReport.jobId).toBe(job.id)
    expect(res.body.existing).toEqual(expect.arrayContaining(['Python']))
    expect(res.body.supportedByResume).toEqual(expect.arrayContaining(['Kubernetes']))
  })

  it('does not confuse two different jobs that share the same title', async () => {
    const app = buildApp()
    const jobA = await seedJobAndMasterResume(app, token)
    const createdB = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', description: '## Requirements\n- Go\n' })
    const jobB = createdB.body.job

    await request(app).post(`/api/jobs/${jobA.id}/skill-gap`).set('Authorization', `Bearer ${token}`)

    const resB = await request(app).get(`/api/jobs/${jobB.id}/skill-gap`).set('Authorization', `Bearer ${token}`)
    expect(resB.body.skillGapReport).toBeNull() // jobB has its own (empty) history, not jobA's
  })
})

// There is no POST /api/jobs/discover any more (2026-09-06 product decision:
// discovery is system-internal, never candidate-triggered — see
// discoveryService.test.ts / discoveryCron.test.ts for that logic now).
it('POST /api/jobs/discover no longer exists', async () => {
  const app = buildApp()
  const res = await request(app).post('/api/jobs/discover').set('Authorization', `Bearer ${token}`)
  expect(res.status).toBe(404)
})

describe('GET /api/jobs — auto-surfacing matched pool jobs', () => {
  async function seedPoolListing(overrides: Record<string, unknown> = {}) {
    return jobListingRepo.save(
      jobListingRepo.create({
        source: 'jsearch',
        url: `https://example.com/pool-${jobListingRepo.rows.length}`,
        urlHash: `hash-${jobListingRepo.rows.length}`,
        title: 'Backend Engineer',
        company: 'Acme',
        location: 'Bengaluru',
        salary: null,
        description: 'Backend role needing Python and Kubernetes experience.',
        normalizedFields: {},
        skills: ['Python', 'Kubernetes'],
        experienceLevel: null,
        isRemote: false,
        lastSeenAt: new Date(),
        ...overrides,
      })
    )
  }

  async function saveMasterResume(userId: string, skills: string[]) {
    const masterResume = resumeRepo.create({
      userId,
      type: ResumeVersionType.MASTER,
      status: ArtifactStatus.DRAFT,
      content: {
        summary: 'Backend engineer with production experience deploying on Kubernetes and writing Python services.',
        experience: [],
        skills: skills.map((name) => ({ name })),
        projects: [],
      },
      createdAt: new Date(),
    })
    return resumeRepo.save(masterResume)
  }

  it('returns no jobs and needsMasterResume: true when the caller has no master resume yet', async () => {
    const app = buildApp()
    await seedPoolListing()

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.jobs).toEqual([])
    expect(res.body.needsMasterResume).toBe(true)
    expect(userJobRepo.rows).toHaveLength(0) // never attached — nothing to score against
  })

  it('auto-attaches a pool listing that scores well against the master resume, without any discover call', async () => {
    const app = buildApp()
    await seedPoolListing()
    await saveMasterResume(USER_ID, ['Python', 'Kubernetes'])

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.needsMasterResume).toBe(false)
    expect(res.body.jobs).toHaveLength(1)
    expect(res.body.jobs[0].title).toBe('Backend Engineer')
    expect(typeof res.body.jobs[0].matchScore).toBe('number')
    expect(userJobRepo.rows).toHaveLength(1) // lazily created
    expect(matchResultRepo.rows).toHaveLength(1) // persisted so the detail page shows a score immediately
  })

  it('does not surface a pool listing that scores below the threshold', async () => {
    const app = buildApp()
    jobListingRepo.rows.push(
      await seedPoolListing({ title: 'Watercolor Painting Instructor', skills: ['Watercolor', 'Art History'], description: 'Teach watercolor painting workshops.' })
    )
    await saveMasterResume(USER_ID, ['Python', 'Kubernetes'])

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    expect(res.body.jobs).toEqual([])
    expect(userJobRepo.rows).toHaveLength(0)
  })

  it('is idempotent — a second call does not re-attach or duplicate an already-surfaced job', async () => {
    const app = buildApp()
    await seedPoolListing()
    await saveMasterResume(USER_ID, ['Python', 'Kubernetes'])

    await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)
    await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    expect(userJobRepo.rows).toHaveLength(1)
    expect(matchResultRepo.rows).toHaveLength(1)
  })

  it("never surfaces the same pool job to a different candidate it wasn't matched for", async () => {
    const app = buildApp()
    await seedPoolListing()
    await saveMasterResume(USER_ID, ['Python', 'Kubernetes'])
    await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    const otherToken = signToken(OTHER_USER_ID, 'FREE')
    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${otherToken}`)

    expect(res.body.needsMasterResume).toBe(true) // other user has no master resume
    expect(res.body.jobs).toEqual([])
  })

  it('a lapsed FREE user with no custom key still gets new jobs surfaced, but aiFeaturesLocked is true and the score is hidden', async () => {
    const app = buildApp()
    await seedPoolListing()
    await saveMasterResume(USER_ID, ['Python', 'Kubernetes'])
    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.aiFeaturesLocked).toBe(true)
    expect(res.body.jobs).toHaveLength(1) // still surfaced, skill-match based
    expect(res.body.jobs[0].matchScore).toBeNull() // but the score isn't shown
    expect(userJobRepo.rows).toHaveLength(1)
    expect(matchResultRepo.rows).toHaveLength(1) // still computed/persisted internally, just not exposed
  })

  it('a FREE user with a valid custom model connection sees the score too', async () => {
    const { encrypt } = require('../../src/utils/encryption')
    const app = buildApp()
    await seedPoolListing()
    await saveMasterResume(USER_ID, ['Python', 'Kubernetes'])
    userRepo.rows[0] = {
      ...userRepo.rows[0],
      plan: Plan.FREE,
      planExpiresAt: null,
      settings: { modelConnection: encrypt('sk-ant-user-owned-key') },
    }

    const res = await request(app).get('/api/jobs').set('Authorization', `Bearer ${token}`)

    expect(res.body.aiFeaturesLocked).toBe(false)
    expect(res.body.jobs).toHaveLength(1)
    expect(typeof res.body.jobs[0].matchScore).toBe('number')
    expect(userJobRepo.rows).toHaveLength(1)
  })
})

describe('POST /api/jobs/:id/cover-letter', () => {
  it('requires a master resume to exist first', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', description: 'desc' })

    const res = await request(app)
      .post(`/api/jobs/${created.body.job.id}/cover-letter`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NO_MASTER_RESUME')
  })

  it('generates and persists a cover letter from the job + master resume', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)

    const res = await request(app)
      .post(`/api/jobs/${job.id}/cover-letter`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(mockGenerateCoverLetter).toHaveBeenCalledTimes(1)
    expect(res.body.coverLetter.userId).toBe(USER_ID)
    expect(res.body.coverLetter.jobId).toBe(job.id)
    expect(res.body.coverLetter.content.letter.role_title).toBe('Backend Engineer')
    expect(coverLetterRepo.rows).toHaveLength(1)
  })
})

describe('AI-feature lock on tailored résumés and cover letters (2026-09-22 — no more monthly quota, hard lock instead)', () => {
  it('blocks a FREE user with no custom key from generating a cover letter, but PREMIUM works', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }

    const blocked = await request(app).post(`/api/jobs/${job.id}/cover-letter`).set('Authorization', `Bearer ${token}`)
    expect(blocked.status).toBe(402)
    expect(blocked.body.error.code).toBe('AI_FEATURE_LOCKED')

    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.PREMIUM, planExpiresAt: new Date(Date.now() + 1000000) }
    const stillWorks = await request(app).post(`/api/jobs/${job.id}/cover-letter`).set('Authorization', `Bearer ${token}`)
    expect(stillWorks.status).toBe(201)
  })

  it('blocks a FREE user with no custom key from tailoring a résumé', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }

    const blocked = await request(app).post(`/api/jobs/${job.id}/tailor`).set('Authorization', `Bearer ${token}`)
    expect(blocked.status).toBe(402)
    expect(blocked.body.error.code).toBe('AI_FEATURE_LOCKED')
  })

  it('a FREE user with their own model connection can tailor/generate freely, no cap', async () => {
    const { encrypt } = require('../../src/utils/encryption')
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    userRepo.rows[0] = {
      ...userRepo.rows[0],
      plan: Plan.FREE,
      planExpiresAt: null,
      settings: { modelConnection: encrypt('sk-ant-user-owned-key') },
    }

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post(`/api/jobs/${job.id}/tailor`).set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(201)
    }
  })

  it('blocks a FREE user with no custom key from computing a skill gap, but PREMIUM works', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }

    const blocked = await request(app).post(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)
    expect(blocked.status).toBe(402)
    expect(blocked.body.error.code).toBe('AI_FEATURE_LOCKED')

    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.PREMIUM, planExpiresAt: new Date(Date.now() + 1000000) }
    const stillWorks = await request(app).post(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)
    expect(stillWorks.status).toBe(201)
  })

  it('hides an already-computed skill gap from a locked FREE user, even though it still exists', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)

    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }
    const res = await request(app).get(`/api/jobs/${job.id}/skill-gap`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.skillGapReport).toBeNull()
    expect(skillGapRepo.rows).toHaveLength(1) // still there, just not returned
  })

  it('hides an already-computed match result from a locked FREE user, even though it still exists', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)

    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }
    const res = await request(app).get(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.matchResult).toBeNull()
    expect(matchResultRepo.rows).toHaveLength(1) // still there, just not returned
  })
})

describe('GET /api/jobs/:id/cover-letter', () => {
  it('returns null when no cover letter has been generated yet', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    const res = await request(app).get(`/api/jobs/${job.id}/cover-letter`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.coverLetter).toBeNull()
  })

  it('returns the generated cover letter after one exists', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/cover-letter`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/jobs/${job.id}/cover-letter`).set('Authorization', `Bearer ${token}`)
    expect(res.body.coverLetter.jobId).toBe(job.id)
  })
})

describe('GET /api/jobs/:id/cover-letter/pdf', () => {
  it('404s when no cover letter has been generated yet', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    const res = await request(app).get(`/api/jobs/${job.id}/cover-letter/pdf`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('streams a PDF once a cover letter exists', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/cover-letter`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/jobs/${job.id}/cover-letter/pdf`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(mockRenderHtmlToPdf).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/jobs/:id/match', () => {
  it('requires a master resume to exist first', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', description: 'desc' })

    const res = await request(app).post(`/api/jobs/${created.body.job.id}/match`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NO_MASTER_RESUME')
  })

  it('computes and persists a MatchResult scoped to the caller', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)

    const res = await request(app).post(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(res.body.matchResult.userId).toBe(USER_ID)
    expect(res.body.matchResult.jobId).toBe(job.id)
    expect(typeof res.body.matchResult.score).toBe('number')
    expect(res.body.matchResult.rationale.matchedSkills).toEqual(expect.arrayContaining(['Python']))
    expect(matchResultRepo.rows).toHaveLength(1)
  })

  it('blocks a lapsed FREE user with no custom key', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    userRepo.rows[0] = { ...userRepo.rows[0], plan: Plan.FREE, planExpiresAt: null }

    const res = await request(app).post(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(402)
    expect(res.body.error.code).toBe('AI_FEATURE_LOCKED')
    expect(matchResultRepo.rows).toHaveLength(0)
  })

  it('allows a lapsed FREE user who has configured their own model connection', async () => {
    const { encrypt } = require('../../src/utils/encryption')
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    userRepo.rows[0] = {
      ...userRepo.rows[0],
      plan: Plan.FREE,
      planExpiresAt: null,
      settings: { modelConnection: encrypt('sk-ant-user-owned-key') },
    }

    const res = await request(app).post(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(201)
  })
})

describe('GET /api/jobs/:id/match', () => {
  it('returns null before any match has been computed', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    const res = await request(app).get(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)
    expect(res.body.matchResult).toBeNull()
  })

  it('returns the latest match result once computed', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/jobs/${job.id}/match`).set('Authorization', `Bearer ${token}`)
    expect(res.body.matchResult.jobId).toBe(job.id)
  })
})

describe('POST /api/jobs/:id/tailor', () => {
  it('requires a master resume to exist first', async () => {
    const app = buildApp()
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Backend Engineer', description: 'desc' })

    const res = await request(app)
      .post(`/api/jobs/${created.body.job.id}/tailor`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NO_MASTER_RESUME')
  })

  it('generates and persists a TAILORED resume version scoped to the job', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)

    const res = await request(app)
      .post(`/api/jobs/${job.id}/tailor`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(mockTailorResume).toHaveBeenCalledTimes(1)
    expect(res.body.tailoredResume.userId).toBe(USER_ID)
    expect(res.body.tailoredResume.jobId).toBe(job.id)
    expect(res.body.tailoredResume.type).toBe(ResumeVersionType.TAILORED)
    expect(res.body.tailoredResume.content.summary).toBe('Tailored: Backend engineer.')
    expect(resumeRepo.rows).toHaveLength(2) // master + tailored
  })
})

describe('GET /api/jobs/:id/tailor', () => {
  it('returns null when no tailored resume has been generated yet', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    const res = await request(app).get(`/api/jobs/${job.id}/tailor`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.tailoredResume).toBeNull()
  })

  it('returns the latest tailored resume once generated', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/tailor`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/jobs/${job.id}/tailor`).set('Authorization', `Bearer ${token}`)
    expect(res.body.tailoredResume.jobId).toBe(job.id)
  })
})

describe('GET /api/jobs/:id/tailor/pdf', () => {
  it('404s when no tailored resume has been generated yet', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    const res = await request(app).get(`/api/jobs/${job.id}/tailor/pdf`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('streams a PDF once a tailored resume exists', async () => {
    const app = buildApp()
    const job = await seedJobAndMasterResume(app, token)
    await request(app).post(`/api/jobs/${job.id}/tailor`).set('Authorization', `Bearer ${token}`)

    const res = await request(app).get(`/api/jobs/${job.id}/tailor/pdf`).set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(mockRenderHtmlToPdf).toHaveBeenCalledTimes(1)
  })
})
