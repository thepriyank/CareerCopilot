import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { LinkedInReviewReport } from '../../src/entities/LinkedInReviewReport'
import { createFakeRepo } from './testUtils/fakeRepo'

const reportRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { LinkedInReviewReport } = require('../../src/entities/LinkedInReviewReport')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === LinkedInReviewReport) return reportRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

const mockReviewLinkedInProfile = jest.fn(async (input: { headline?: string }) => ({
  overallScore: 65,
  sections: { headline: { score: 65, narrative: 'Decent but generic.' } },
  headlineRewrites: [{ label: 'Outcome-first', text: `Rewritten: ${input.headline}` }],
}))
jest.mock('../../src/services/ai/linkedinReviewer', () => ({
  reviewLinkedInProfile: (...args: unknown[]) => mockReviewLinkedInProfile(...(args as [any])),
}))

const mockExtractLinkedInProfileFromPdf = jest.fn(async (..._args: unknown[]) => ({
  headline: 'Senior Backend Engineer @ Acme',
  about: 'Builds payments infra.',
  experience: 'Senior Backend Engineer, Acme',
  skills: 'Node.js, TypeScript',
  rawTextLength: 500,
}))
jest.mock('../../src/services/ai/linkedinPdfExtractor', () => ({
  extractLinkedInProfileFromPdf: (...args: unknown[]) => mockExtractLinkedInProfileFromPdf(...(args as [any])),
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import linkedinRoutes from '../../src/routes/linkedin.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/linkedin', linkedinRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  reportRepo.rows.length = 0
  mockReviewLinkedInProfile.mockClear()
  mockExtractLinkedInProfileFromPdf.mockClear()
})

describe('POST /api/linkedin/review', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).post('/api/linkedin/review').send({ headline: 'X' })
    expect(res.status).toBe(401)
  })

  it('rejects a request with no sections at all', async () => {
    const res = await request(buildApp())
      .post('/api/linkedin/review')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('reviews the profile and persists a LinkedInReviewReport', async () => {
    const res = await request(buildApp())
      .post('/api/linkedin/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ headline: 'Backend Engineer @ Acme' })

    expect(res.status).toBe(201)
    expect(mockReviewLinkedInProfile).toHaveBeenCalledTimes(1)
    expect(res.body.report.userId).toBe(USER_ID)
    expect(res.body.report.overallScore).toBe(65)
    expect(res.body.report.sections.headline.narrative).toBe('Decent but generic.')
    expect(reportRepo.rows).toHaveLength(1)
  })
})

describe('GET /api/linkedin/review', () => {
  it('returns null when no review exists yet', async () => {
    const res = await request(buildApp()).get('/api/linkedin/review').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.report).toBeNull()
  })

  it('returns the latest review after one exists', async () => {
    await request(buildApp())
      .post('/api/linkedin/review')
      .set('Authorization', `Bearer ${token}`)
      .send({ headline: 'Backend Engineer' })

    const res = await request(buildApp()).get('/api/linkedin/review').set('Authorization', `Bearer ${token}`)
    expect(res.body.report.overallScore).toBe(65)
  })
})

describe('POST /api/linkedin/extract-pdf', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).post('/api/linkedin/extract-pdf')
    expect(res.status).toBe(401)
  })

  it('rejects a request with no file', async () => {
    const res = await request(buildApp())
      .post('/api/linkedin/extract-pdf')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('NO_FILE')
  })

  it('rejects a non-PDF file', async () => {
    const res = await request(buildApp())
      .post('/api/linkedin/extract-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not a pdf'), { filename: 'profile.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE')
  })

  it('extracts profile fields from an uploaded PDF and does not persist anything', async () => {
    const res = await request(buildApp())
      .post('/api/linkedin/extract-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'profile.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(200)
    expect(mockExtractLinkedInProfileFromPdf).toHaveBeenCalledTimes(1)
    expect(res.body.extracted.headline).toBe('Senior Backend Engineer @ Acme')
    expect(res.body.extracted.skills).toBe('Node.js, TypeScript')
    expect(reportRepo.rows).toHaveLength(0) // review isn't run/saved until the user separately confirms via POST /review
  })

  it('surfaces an extraction failure as a 422 with the real message', async () => {
    mockExtractLinkedInProfileFromPdf.mockRejectedValueOnce(new Error('This PDF has no readable text'))

    const res = await request(buildApp())
      .post('/api/linkedin/extract-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'profile.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('EXTRACT_FAILED')
    expect(res.body.error.message).toBe('This PDF has no readable text')
  })
})
