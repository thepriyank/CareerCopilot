import express from 'express'
import request from 'supertest'
import { signToken } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/errorHandler'
import { SkillGapReport } from '../../src/entities/SkillGapReport'
import { MatchResult } from '../../src/entities/MatchResult'
import { CourseRecommendation } from '../../src/entities/CourseRecommendation'
import { createFakeRepo } from './testUtils/fakeRepo'

const skillGapRepo = createFakeRepo()
const matchRepo = createFakeRepo()
const courseRepo = createFakeRepo()

jest.mock('../../src/config/dataSource', () => {
  const { SkillGapReport } = require('../../src/entities/SkillGapReport')
  const { MatchResult } = require('../../src/entities/MatchResult')
  const { CourseRecommendation } = require('../../src/entities/CourseRecommendation')
  return {
    AppDataSource: {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === SkillGapReport) return skillGapRepo
        if (entity === MatchResult) return matchRepo
        if (entity === CourseRecommendation) return courseRepo
        throw new Error(`No fake repo registered for entity: ${entity}`)
      }),
    },
  }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
import skillGapsRoutes from '../../src/routes/skillGaps.routes'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/skill-gaps', skillGapsRoutes)
  app.use(errorHandler)
  return app
}

const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const token = signToken(USER_ID, 'FREE')

beforeEach(() => {
  skillGapRepo.rows.length = 0
  matchRepo.rows.length = 0
  courseRepo.rows.length = 0
})

describe('GET /api/skill-gaps', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(buildApp()).get('/api/skill-gaps')
    expect(res.status).toBe(401)
  })

  it('aggregates missing skills across the caller\'s reports, weighted by match score, and lists saved goals', async () => {
    skillGapRepo.rows.push(
      { id: 'sg1', userId: USER_ID, jobId: 'job-1', missingSkills: ['System design'], createdAt: new Date('2026-01-01') } as never,
      { id: 'sg2', userId: USER_ID, jobId: 'job-2', missingSkills: ['System design', 'Go'], createdAt: new Date('2026-01-02') } as never,
      { id: 'sg3', userId: OTHER_USER_ID, jobId: 'job-3', missingSkills: ['Rust'], createdAt: new Date('2026-01-01') } as never
    )
    matchRepo.rows.push(
      { id: 'm1', userId: USER_ID, jobId: 'job-1', score: 20 } as never,
      { id: 'm2', userId: USER_ID, jobId: 'job-2', score: 90 } as never
    )
    courseRepo.rows.push(
      { id: 'c1', userId: USER_ID, metadata: { skill: 'Go' } } as never
    )

    const res = await request(buildApp()).get('/api/skill-gaps').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const systemDesign = res.body.gaps.find((g: { skill: string }) => g.skill === 'System design')
    expect(systemDesign.frequency).toBe(2)
    expect(systemDesign.weight).toBe(45) // (80 + 10) / 2, other user's Rust excluded
    expect(res.body.gaps.map((g: { skill: string }) => g.skill)).not.toContain('Rust')
    expect(res.body.savedGoals).toEqual(['Go'])
  })
})

describe('POST /api/skill-gaps/:skill/goal', () => {
  it('404s when the skill was never reported as missing for this caller', async () => {
    const res = await request(buildApp())
      .post('/api/skill-gaps/Rust/goal')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('persists a search-link CourseRecommendation tied to the most recent report containing the skill', async () => {
    skillGapRepo.rows.push(
      { id: 'sg1', userId: USER_ID, jobId: 'job-1', missingSkills: ['System design'], createdAt: new Date('2026-01-01') } as never,
      { id: 'sg2', userId: USER_ID, jobId: 'job-2', missingSkills: ['System design'], createdAt: new Date('2026-01-05') } as never
    )

    const res = await request(buildApp())
      .post('/api/skill-gaps/System%20design/goal')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(201)
    expect(res.body.courseRecommendation.skillGapId).toBe('sg2') // the more recent report
    expect(res.body.courseRecommendation.provider).toBe('search-link')
    expect(res.body.courseRecommendation.url).toContain('System%20design')
    expect(courseRepo.rows).toHaveLength(1)
  })
})
