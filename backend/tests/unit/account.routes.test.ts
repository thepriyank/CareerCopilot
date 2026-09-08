import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { User } from '../../src/entities/User'
import { ResumeFile } from '../../src/entities/ResumeFile'
import { ParsedResume } from '../../src/entities/ParsedResume'
import { CandidateProfile } from '../../src/entities/CandidateProfile'
import { MatchResult } from '../../src/entities/MatchResult'
import { GeneratedResumeVersion } from '../../src/entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../src/entities/GeneratedCoverLetter'
import { ApprovalRecord } from '../../src/entities/ApprovalRecord'
import { SkillGapReport } from '../../src/entities/SkillGapReport'
import { LinkedInReviewReport } from '../../src/entities/LinkedInReviewReport'
import { createFakeRepo } from './testUtils/fakeRepo'
import type { JobView } from '../../src/services/jobs/jobView'

const userRepo = createFakeRepo()
const resumeFileRepo = createFakeRepo()
const parsedResumeRepo = createFakeRepo()
const profileRepo = createFakeRepo()
const matchRepo = createFakeRepo()
const resumeVersionRepo = createFakeRepo()
const coverLetterRepo = createFakeRepo()
const approvalRepo = createFakeRepo()
const skillGapRepo = createFakeRepo()
const linkedInRepo = createFakeRepo()

// jobView.ts is the seam routes use for job data (a join over UserJob +
// JobListing) — mocked directly rather than faking that join through the
// generic fake repo, which has no concept of relations.
const jobViews: JobView[] = []
jest.mock('../../src/services/jobs/jobView', () => ({
  listJobViews: jest.fn(async (userId: string) => jobViews.filter((j) => j.userId === userId)),
}))

jest.mock('../../src/config/dataSource', () => {
  const { User } = require('../../src/entities/User')
  const { ResumeFile } = require('../../src/entities/ResumeFile')
  const { ParsedResume } = require('../../src/entities/ParsedResume')
  const { CandidateProfile } = require('../../src/entities/CandidateProfile')
  const { MatchResult } = require('../../src/entities/MatchResult')
  const { GeneratedResumeVersion } = require('../../src/entities/GeneratedResumeVersion')
  const { GeneratedCoverLetter } = require('../../src/entities/GeneratedCoverLetter')
  const { ApprovalRecord } = require('../../src/entities/ApprovalRecord')
  const { SkillGapReport } = require('../../src/entities/SkillGapReport')
  const { LinkedInReviewReport } = require('../../src/entities/LinkedInReviewReport')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return userRepo
        if (entity === ResumeFile) return resumeFileRepo
        if (entity === ParsedResume) return parsedResumeRepo
        if (entity === CandidateProfile) return profileRepo
        if (entity === MatchResult) return matchRepo
        if (entity === GeneratedResumeVersion) return resumeVersionRepo
        if (entity === GeneratedCoverLetter) return coverLetterRepo
        if (entity === ApprovalRecord) return approvalRepo
        if (entity === SkillGapReport) return skillGapRepo
        if (entity === LinkedInReviewReport) return linkedInRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// Storage is now backend-abstracted (local disk vs. GCS — see
// services/storage/fileStorage.ts) — mocked at that boundary rather than at
// the old fs-specific level, so this test doesn't care which backend is active.
const mockDeleteFile = jest.fn(async (_filename: string) => {})
jest.mock('../../src/services/storage/fileStorage', () => ({
  deleteFile: (...args: unknown[]) => mockDeleteFile(...(args as [string])),
  filenameFromUrl: (url: string) => url,
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import accountRoutes from '../../src/routes/account.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/account', accountRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  userRepo.rows.length = 0
  resumeFileRepo.rows.length = 0
  parsedResumeRepo.rows.length = 0
  profileRepo.rows.length = 0
  jobViews.length = 0
  matchRepo.rows.length = 0
  resumeVersionRepo.rows.length = 0
  coverLetterRepo.rows.length = 0
  approvalRepo.rows.length = 0
  skillGapRepo.rows.length = 0
  linkedInRepo.rows.length = 0
  mockDeleteFile.mockClear()
})

describe('GET /api/account/export', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/account/export')
    expect(res.status).toBe(401)
  })

  it('bundles every entity scoped to the caller, excluding raw file bytes', async () => {
    profileRepo.rows.push({ id: 'p1', userId: USER_ID, targetRoles: ['Backend Engineer'] } as never)
    resumeFileRepo.rows.push({ id: 'f1', userId: USER_ID, fileName: 'resume.pdf', fileType: 'PDF', uploadedAt: new Date() } as never)
    jobViews.push({ id: 'j1', userId: USER_ID, title: 'Backend Engineer' } as never)

    const res = await request(buildApp()).get('/api/account/export').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.profile.targetRoles).toEqual(['Backend Engineer'])
    expect(res.body.resumeFiles).toEqual([{ id: 'f1', fileName: 'resume.pdf', fileType: 'PDF', uploadedAt: expect.any(String) }])
    expect(res.body.resumeFiles[0]).not.toHaveProperty('fileUrl')
    expect(res.body.jobs).toHaveLength(1)
    expect(res.body.exportedAt).toBeDefined()
  })
})

describe('DELETE /api/account', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).delete('/api/account')
    expect(res.status).toBe(401)
  })

  it("deletes the caller's resume files (via whichever storage backend is active) and removes the User row", async () => {
    userRepo.rows.push({ id: USER_ID, email: 'x@example.com' } as never)
    resumeFileRepo.rows.push(
      { id: 'f1', userId: USER_ID, fileUrl: 'abc.pdf' } as never,
      { id: 'f2', userId: USER_ID, fileUrl: 'def.docx' } as never
    )

    const res = await request(buildApp()).delete('/api/account').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(mockDeleteFile).toHaveBeenCalledTimes(2)
    expect(mockDeleteFile).toHaveBeenCalledWith('abc.pdf')
    expect(mockDeleteFile).toHaveBeenCalledWith('def.docx')
    expect(userRepo.rows.find((r) => r.id === USER_ID)).toBeUndefined()
  })

  it('still deletes the account even if a file is already missing from storage', async () => {
    userRepo.rows.push({ id: USER_ID, email: 'x@example.com' } as never)
    resumeFileRepo.rows.push({ id: 'f1', userId: USER_ID, fileUrl: 'missing.pdf' } as never)
    // deleteFile already swallows its own errors (see fileStorage.ts) — this
    // confirms the route doesn't add a second layer of failure on top.
    mockDeleteFile.mockResolvedValueOnce(undefined)

    const res = await request(buildApp()).delete('/api/account').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(mockDeleteFile).toHaveBeenCalledWith('missing.pdf')
    expect(userRepo.rows.find((r) => r.id === USER_ID)).toBeUndefined()
  })
})
