import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { GeneratedResumeVersion } from '../../src/entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../src/entities/GeneratedCoverLetter'
import { MatchResult } from '../../src/entities/MatchResult'
import { ApprovalRecord } from '../../src/entities/ApprovalRecord'
import { SkillGapReport } from '../../src/entities/SkillGapReport'
import { LinkedInReviewReport } from '../../src/entities/LinkedInReviewReport'
import { ArtifactStatus, ArtifactType, ResumeVersionType } from '../../src/entities/enums'
import { createFakeRepo } from './testUtils/fakeRepo'
import type { JobView } from '../../src/services/jobs/jobView'

const resumeRepo = createFakeRepo()
const coverLetterRepo = createFakeRepo()
const matchRepo = createFakeRepo()
const approvalRepo = createFakeRepo()
const skillGapRepo = createFakeRepo()
const linkedInRepo = createFakeRepo()

// jobView.ts already IS the seam routes use for job data (a join over
// UserJob + JobListing) — mocked directly here rather than faking that join
// through the generic fake repo, which has no concept of relations.
const jobViews: JobView[] = []
jest.mock('../../src/services/jobs/jobView', () => ({
  listJobViews: jest.fn(async (userId: string) => jobViews.filter((j) => j.userId === userId)),
}))

jest.mock('../../src/config/dataSource', () => {
  const { GeneratedResumeVersion } = require('../../src/entities/GeneratedResumeVersion')
  const { GeneratedCoverLetter } = require('../../src/entities/GeneratedCoverLetter')
  const { MatchResult } = require('../../src/entities/MatchResult')
  const { ApprovalRecord } = require('../../src/entities/ApprovalRecord')
  const { SkillGapReport } = require('../../src/entities/SkillGapReport')
  const { LinkedInReviewReport } = require('../../src/entities/LinkedInReviewReport')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === GeneratedResumeVersion) return resumeRepo
        if (entity === GeneratedCoverLetter) return coverLetterRepo
        if (entity === MatchResult) return matchRepo
        if (entity === ApprovalRecord) return approvalRepo
        if (entity === SkillGapReport) return skillGapRepo
        if (entity === LinkedInReviewReport) return linkedInRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
import dashboardRoutes from '../../src/routes/dashboard.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/dashboard', dashboardRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  resumeRepo.rows.length = 0
  coverLetterRepo.rows.length = 0
  matchRepo.rows.length = 0
  approvalRepo.rows.length = 0
  skillGapRepo.rows.length = 0
  jobViews.length = 0
  linkedInRepo.rows.length = 0
})

describe('GET /api/dashboard', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/dashboard')
    expect(res.status).toBe(401)
  })

  it('returns a sensible empty rollup for a brand-new user', async () => {
    const res = await request(buildApp()).get('/api/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.masterResume).toBeNull()
    expect(res.body.matchesThisWeek).toBe(0)
    expect(res.body.pendingApprovalCount).toBe(0)
    expect(res.body.approvalRate).toBeNull()
    expect(res.body.topMatches).toEqual([])
    expect(res.body.recentActivity).toEqual([])
    expect(res.body.topSkillGap).toBeNull()
    expect(res.body.linkedIn).toBeNull()
  })

  it('computes matchesThisWeek, pending/reviewed counts, and approval rate from real records', async () => {
    const now = new Date()
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)

    matchRepo.rows.push(
      { id: 'm1', userId: USER_ID, jobId: 'job-1', score: 80, rationale: {}, createdAt: now } as never,
      { id: 'm2', userId: USER_ID, jobId: 'job-2', score: 60, rationale: {}, createdAt: eightDaysAgo } as never
    )
    resumeRepo.rows.push(
      { id: 'r1', userId: USER_ID, type: ResumeVersionType.MASTER, status: ArtifactStatus.DRAFT, jobId: null, createdAt: now, updatedAt: now } as never,
      { id: 'r2', userId: USER_ID, type: ResumeVersionType.TAILORED, status: ArtifactStatus.IN_REVIEW, jobId: 'job-1', createdAt: now, updatedAt: now } as never
    )
    approvalRepo.rows.push(
      { id: 'a1', userId: USER_ID, artifactType: ArtifactType.RESUME_VERSION, status: ArtifactStatus.APPROVED, timestamp: now } as never,
      { id: 'a2', userId: USER_ID, artifactType: ArtifactType.COVER_LETTER, status: ArtifactStatus.REJECTED, timestamp: now } as never
    )

    const res = await request(buildApp()).get('/api/dashboard').set('Authorization', `Bearer ${token}`)

    expect(res.body.matchesThisWeek).toBe(1) // only the recent one
    expect(res.body.pendingApprovalCount).toBe(2) // both resumes are non-approved
    expect(res.body.reviewedCount).toBe(1) // r2 is IN_REVIEW
    expect(res.body.approvalRate).toBe(50) // 1 approved of 2 decided
  })

  it('returns the top 3 matches sorted by score, joined with job context', async () => {
    jobViews.push(
      { id: 'job-1', userId: USER_ID, title: 'A', company: 'Co A' } as never,
      { id: 'job-2', userId: USER_ID, title: 'B', company: 'Co B' } as never,
      { id: 'job-3', userId: USER_ID, title: 'C', company: 'Co C' } as never,
      { id: 'job-4', userId: USER_ID, title: 'D', company: 'Co D' } as never
    )
    matchRepo.rows.push(
      { id: 'm1', userId: USER_ID, jobId: 'job-1', score: 50, rationale: { matchedSkills: ['X'] }, createdAt: new Date() } as never,
      { id: 'm2', userId: USER_ID, jobId: 'job-2', score: 90, rationale: {}, createdAt: new Date() } as never,
      { id: 'm3', userId: USER_ID, jobId: 'job-3', score: 70, rationale: {}, createdAt: new Date() } as never,
      { id: 'm4', userId: USER_ID, jobId: 'job-4', score: 30, rationale: {}, createdAt: new Date() } as never
    )

    const res = await request(buildApp()).get('/api/dashboard').set('Authorization', `Bearer ${token}`)

    expect(res.body.topMatches).toHaveLength(3)
    expect(res.body.topMatches.map((m: { title: string }) => m.title)).toEqual(['B', 'C', 'A'])
    expect(res.body.topMatches[2].matchedSkills).toEqual(['X'])
  })

  it('aggregates the top skill gap the same way the roadmap page does', async () => {
    skillGapRepo.rows.push({ id: 'sg1', userId: USER_ID, jobId: 'job-1', missingSkills: ['Go'] } as never)
    matchRepo.rows.push({ id: 'm1', userId: USER_ID, jobId: 'job-1', score: 20, rationale: {}, createdAt: new Date() } as never)

    const res = await request(buildApp()).get('/api/dashboard').set('Authorization', `Bearer ${token}`)

    expect(res.body.topSkillGap.skill).toBe('Go')
    expect(res.body.topSkillGap.weight).toBe(80)
  })

  it('surfaces the latest LinkedIn review summary', async () => {
    linkedInRepo.rows.push({
      id: 'l1', userId: USER_ID, overallScore: 71,
      suggestions: { headlineRewrites: [{ label: 'Impact', text: 'Rewritten headline' }] },
      createdAt: new Date(),
    } as never)

    const res = await request(buildApp()).get('/api/dashboard').set('Authorization', `Bearer ${token}`)

    expect(res.body.linkedIn).toEqual({ overallScore: 71, headlineRewrite: 'Rewritten headline' })
  })
})
