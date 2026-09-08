import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { GeneratedResumeVersion } from '../../src/entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../src/entities/GeneratedCoverLetter'
import { ApprovalRecord } from '../../src/entities/ApprovalRecord'
import { ArtifactStatus, ArtifactType, ResumeVersionType } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'
import type { JobView } from '../../src/services/jobs/jobView'

const resumeRepo = createFakeRepo()
const coverLetterRepo = createFakeRepo()
const approvalRepo = createFakeRepo()

// jobView.ts is the seam routes use for job data (a join over UserJob +
// JobListing) — mocked directly rather than faking that join through the
// generic fake repo, which has no concept of relations.
const jobViews: JobView[] = []
jest.mock('../../src/services/jobs/jobView', () => ({
  listJobViews: jest.fn(async (userId: string) => jobViews.filter((j) => j.userId === userId)),
}))

jest.mock('../../src/config/dataSource', () => {
  const { GeneratedResumeVersion } = require('../../src/entities/GeneratedResumeVersion')
  const { GeneratedCoverLetter } = require('../../src/entities/GeneratedCoverLetter')
  const { ApprovalRecord } = require('../../src/entities/ApprovalRecord')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === GeneratedResumeVersion) return resumeRepo
        if (entity === GeneratedCoverLetter) return coverLetterRepo
        if (entity === ApprovalRecord) return approvalRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
import approvalsRoutes from '../../src/routes/approvals.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/approvals', approvalsRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  resumeRepo.rows.length = 0
  coverLetterRepo.rows.length = 0
  approvalRepo.rows.length = 0
  jobViews.length = 0
})

describe('GET /api/approvals', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/approvals')
    expect(res.status).toBe(401)
  })

  it('returns non-approved resume versions and cover letters scoped to the caller, joined with job context', async () => {
    jobViews.push({ id: 'job-1', userId: USER_ID, title: 'Backend Engineer', company: 'Acme' } as never)
    resumeRepo.rows.push(
      { id: 'r1', userId: USER_ID, type: ResumeVersionType.MASTER, status: ArtifactStatus.DRAFT, jobId: null, updatedAt: new Date('2026-01-01'), content: { summary: 'Backend engineer.' } } as never,
      { id: 'r2', userId: USER_ID, type: ResumeVersionType.TAILORED, status: ArtifactStatus.APPROVED, jobId: 'job-1', updatedAt: new Date('2026-01-02'), content: { summary: 'Tailored.' } } as never,
      { id: 'r3', userId: OTHER_USER_ID, type: ResumeVersionType.MASTER, status: ArtifactStatus.DRAFT, jobId: null, updatedAt: new Date('2026-01-01'), content: { summary: 'Not mine.' } } as never
    )
    coverLetterRepo.rows.push(
      { id: 'c1', userId: USER_ID, status: ArtifactStatus.IN_REVIEW, jobId: 'job-1', updatedAt: new Date('2026-01-03'), content: { letter: { opening: 'Dear team,' } } } as never
    )

    const res = await request(buildApp()).get('/api/approvals').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const ids = res.body.artifacts.map((a: { id: string }) => a.id)
    expect(ids).toEqual(['c1', 'r1']) // approved r2 excluded, other-user's r3 excluded, sorted newest first
    const coverLetterArtifact = res.body.artifacts.find((a: { id: string }) => a.id === 'c1')
    expect(coverLetterArtifact.jobTitle).toBe('Backend Engineer')
    expect(coverLetterArtifact.jobCompany).toBe('Acme')
    expect(coverLetterArtifact.preview).toBe('Dear team,')
    const resumeArtifact = res.body.artifacts.find((a: { id: string }) => a.id === 'r1')
    expect(resumeArtifact.preview).toBe('Backend engineer.')
  })
})

describe('POST /api/approvals/resume/:id/approve', () => {
  it('404s for a resume version that does not belong to the caller', async () => {
    resumeRepo.rows.push({ id: 'r1', userId: OTHER_USER_ID, status: ArtifactStatus.DRAFT } as never)
    const res = await request(buildApp())
      .post('/api/approvals/resume/r1/approve')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('flips status to APPROVED and writes an audit ApprovalRecord', async () => {
    resumeRepo.rows.push({ id: 'r1', userId: USER_ID, status: ArtifactStatus.DRAFT } as never)

    const res = await request(buildApp())
      .post('/api/approvals/resume/r1/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Looks good' })

    expect(res.status).toBe(200)
    expect(res.body.resume.status).toBe(ArtifactStatus.APPROVED)
    expect(approvalRepo.rows).toHaveLength(1)
    expect(approvalRepo.rows[0]).toMatchObject({
      userId: USER_ID,
      artifactType: ArtifactType.RESUME_VERSION,
      status: ArtifactStatus.APPROVED,
      notes: 'Looks good',
      resumeVersionId: 'r1',
    })
  })
})

describe('POST /api/approvals/cover-letter/:id/reject', () => {
  it('flips status to REJECTED and writes an audit ApprovalRecord', async () => {
    coverLetterRepo.rows.push({ id: 'c1', userId: USER_ID, status: ArtifactStatus.IN_REVIEW } as never)

    const res = await request(buildApp())
      .post('/api/approvals/cover-letter/c1/reject')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.coverLetter.status).toBe(ArtifactStatus.REJECTED)
    expect(approvalRepo.rows[0]).toMatchObject({
      artifactType: ArtifactType.COVER_LETTER,
      status: ArtifactStatus.REJECTED,
      coverLetterId: 'c1',
    })
  })
})

describe('POST /api/approvals/:type/:id/approve — invalid type', () => {
  it('rejects an unknown artifact type', async () => {
    const res = await request(buildApp())
      .post('/api/approvals/widget/x/approve')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_TYPE')
  })
})
