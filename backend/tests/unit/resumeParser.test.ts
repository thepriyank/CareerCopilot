import { computeConfidenceScores } from '../../src/services/parsing/entityExtractor'
import { ExtractedEntities } from '../../src/types'

// ─── computeConfidenceScores ──────────────────────────────────────────────────

const fullEntities: ExtractedEntities = {
  contact: { name: 'Jane Doe', email: 'jane@example.com', phone: '+1 555 1234' },
  summary: 'Experienced engineer.',
  experience: [
    {
      id: '1',
      company: 'Acme',
      title: 'Engineer',
      bullets: ['Built things', 'Shipped features'],
    },
  ],
  education: [{ id: '1', institution: 'MIT', degree: 'BSc', field: 'CS' }],
  skills: [
    { id: '1', name: 'JavaScript' },
    { id: '2', name: 'TypeScript' },
    { id: '3', name: 'React' },
    { id: '4', name: 'Node.js' },
    { id: '5', name: 'PostgreSQL' },
  ],
  certifications: [],
  projects: [],
}

describe('computeConfidenceScores', () => {
  it('returns high overall score for a complete resume', () => {
    const scores = computeConfidenceScores(fullEntities)
    expect(scores.overall).toBeGreaterThan(0.8)
    expect(scores.name).toBe(1.0)
    expect(scores.email).toBe(1.0)
    expect(scores.phone).toBe(1.0)
    expect(scores.experience).toBe(1.0)
    expect(scores.education).toBe(1.0)
    expect(scores.skills).toBe(1.0)
  })

  it('returns 0 for missing contact fields', () => {
    const entities: ExtractedEntities = {
      ...fullEntities,
      contact: {},
    }
    const scores = computeConfidenceScores(entities)
    expect(scores.name).toBe(0)
    expect(scores.email).toBe(0)
    expect(scores.phone).toBe(0)
    expect(scores.overall).toBeLessThan(0.7)
  })

  it('returns 0.7 for experience without bullets', () => {
    const entities: ExtractedEntities = {
      ...fullEntities,
      experience: [{ id: '1', company: 'Corp', title: 'Dev', bullets: [] }],
    }
    const scores = computeConfidenceScores(entities)
    expect(scores.experience).toBe(0.7)
  })

  it('returns 0 for no experience', () => {
    const entities: ExtractedEntities = { ...fullEntities, experience: [] }
    const scores = computeConfidenceScores(entities)
    expect(scores.experience).toBe(0)
  })

  it('returns 0.5 for 1-4 skills', () => {
    const entities: ExtractedEntities = {
      ...fullEntities,
      skills: [{ id: '1', name: 'JS' }],
    }
    const scores = computeConfidenceScores(entities)
    expect(scores.skills).toBe(0.5)
  })

  it('returns 0 for no skills', () => {
    const entities: ExtractedEntities = { ...fullEntities, skills: [] }
    const scores = computeConfidenceScores(entities)
    expect(scores.skills).toBe(0)
  })

  it('returns 0 for email without @', () => {
    const entities: ExtractedEntities = {
      ...fullEntities,
      contact: { ...fullEntities.contact, email: 'notanemail' },
    }
    const scores = computeConfidenceScores(entities)
    expect(scores.email).toBe(0)
  })

  it('overall is a number between 0 and 1', () => {
    const scores = computeConfidenceScores(fullEntities)
    expect(scores.overall).toBeGreaterThanOrEqual(0)
    expect(scores.overall).toBeLessThanOrEqual(1)
  })
})
