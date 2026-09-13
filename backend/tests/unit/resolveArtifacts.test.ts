import { createFakeRepo } from './testUtils/fakeRepo'
import { ArtifactStatus, ResumeVersionType } from '../../src/entities/enums'

const resumeRepo = createFakeRepo()
const coverLetterRepo = createFakeRepo()
const resumeFileRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { GeneratedResumeVersion } = require('../../src/entities/GeneratedResumeVersion')
  const { GeneratedCoverLetter } = require('../../src/entities/GeneratedCoverLetter')
  const { ResumeFile } = require('../../src/entities/ResumeFile')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === GeneratedResumeVersion) return resumeRepo
        if (entity === GeneratedCoverLetter) return coverLetterRepo
        if (entity === ResumeFile) return resumeFileRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

import { resolveArtifactsForJob } from '../../src/services/extension/resolveArtifacts'

beforeEach(() => {
  resumeRepo.rows.length = 0
  coverLetterRepo.rows.length = 0
  resumeFileRepo.rows.length = 0
})

describe('resolveArtifactsForJob', () => {
  it('prefers an approved tailored resume for the job over the master', async () => {
    resumeRepo.rows.push(
      { id: 'master-1', userId: 'u1', jobId: null, type: ResumeVersionType.MASTER, status: ArtifactStatus.APPROVED, createdAt: new Date('2026-01-01') } as never,
      { id: 'tailored-1', userId: 'u1', jobId: 'job-1', type: ResumeVersionType.TAILORED, status: ArtifactStatus.APPROVED, createdAt: new Date('2026-01-02') } as never
    )

    const result = await resolveArtifactsForJob('u1', 'job-1')
    expect(result.resume).toEqual({ type: 'TAILORED', id: 'tailored-1', downloadUrl: '/api/jobs/job-1/tailor/pdf' })
    expect(result.unapprovedTailoredResumeExists).toBe(false)
  })

  it('falls back to the approved master and nudges when the tailored resume is not approved', async () => {
    resumeRepo.rows.push(
      { id: 'master-1', userId: 'u1', jobId: null, type: ResumeVersionType.MASTER, status: ArtifactStatus.APPROVED, createdAt: new Date('2026-01-01') } as never,
      { id: 'tailored-1', userId: 'u1', jobId: 'job-1', type: ResumeVersionType.TAILORED, status: ArtifactStatus.IN_REVIEW, createdAt: new Date('2026-01-02') } as never
    )

    const result = await resolveArtifactsForJob('u1', 'job-1')
    expect(result.resume).toEqual({ type: 'MASTER', id: 'master-1', downloadUrl: '/api/resume/master/master-1/pdf' })
    expect(result.unapprovedTailoredResumeExists).toBe(true)
  })

  it('falls back to the originally uploaded file when no approved generated resume exists', async () => {
    resumeFileRepo.rows.push({ id: 'file-1', userId: 'u1', uploadedAt: new Date('2026-01-01') } as never)

    const result = await resolveArtifactsForJob('u1', 'job-1')
    expect(result.resume).toEqual({ type: 'ORIGINAL', id: 'file-1', downloadUrl: '/api/resumes/file/file-1' })
  })

  it('never returns a DRAFT master resume', async () => {
    resumeRepo.rows.push({ id: 'master-1', userId: 'u1', jobId: null, type: ResumeVersionType.MASTER, status: ArtifactStatus.DRAFT, createdAt: new Date() } as never)

    const result = await resolveArtifactsForJob('u1', null)
    expect(result.resume).toBeNull()
  })

  it('resolves an approved cover letter for the job', async () => {
    coverLetterRepo.rows.push({ id: 'cl-1', userId: 'u1', jobId: 'job-1', status: ArtifactStatus.APPROVED, createdAt: new Date() } as never)

    const result = await resolveArtifactsForJob('u1', 'job-1')
    expect(result.coverLetter).toEqual({ id: 'cl-1', downloadUrl: '/api/jobs/job-1/cover-letter/pdf' })
  })

  it('never substitutes an unapproved cover letter — returns null instead', async () => {
    coverLetterRepo.rows.push({ id: 'cl-1', userId: 'u1', jobId: 'job-1', status: ArtifactStatus.DRAFT, createdAt: new Date() } as never)

    const result = await resolveArtifactsForJob('u1', 'job-1')
    expect(result.coverLetter).toBeNull()
  })

  it('resolves no résumé/cover-letter fields when job identification failed (jobId null)', async () => {
    const result = await resolveArtifactsForJob('u1', null)
    expect(result.resume).toBeNull()
    expect(result.coverLetter).toBeNull()
    expect(result.unapprovedTailoredResumeExists).toBe(false)
  })
})
