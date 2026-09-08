import { generateCoverLetter } from '../../src/services/ai/coverLetterGenerator'
import { generateJson } from '../../src/services/ai/anthropicClient'
import { JobView } from '../../src/services/jobs/jobView'
import { CandidateProfile } from '../../src/entities/CandidateProfile'
import { ExtractedEntities } from '../../src/types'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockGenerateJson = generateJson as jest.Mock

const job = {
  id: 'job-1',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  location: 'Bengaluru',
  description: '## Requirements\n- Python\n- Kubernetes\n',
} as JobView

const resumeEntities: ExtractedEntities = {
  contact: { name: 'Priya Sharma', email: 'priya@example.com', location: 'Bengaluru, India' },
  summary: 'Backend engineer with 6 years of experience.',
  experience: [
    { id: '1', company: 'Beta Corp', title: 'Backend Engineer', startDate: '2020', current: true, bullets: ['Cut p99 latency by 40% on the payments service'] },
  ],
  education: [],
  skills: [{ id: '1', name: 'Python' }, { id: '2', name: 'Kubernetes' }],
  certifications: [],
  projects: [],
}

const profile = { targetRoles: ['Backend Engineer'] } as CandidateProfile

beforeEach(() => {
  mockGenerateJson.mockReset()
})

describe('generateCoverLetter', () => {
  it('builds a prompt containing the real candidate facts and the no-fabrication rule', async () => {
    mockGenerateJson.mockResolvedValue({
      opening: 'Opening line.',
      profile_intro: 'Intro line.',
      achievements: [{ lead: 'Cut p99 latency', impact: '40% improvement on payments service' }],
      closing: 'Thank you.',
    })

    await generateCoverLetter(job, resumeEntities, profile, 'user-1')

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('Cut p99 latency by 40% on the payments service')
    expect(prompt).toContain('Senior Backend Engineer')
    expect(prompt).toContain('Do NOT invent employers, job titles, skills')
  })

  it('combines deterministic candidate/job facts with the generated narrative into a CoverLetterPayload', async () => {
    mockGenerateJson.mockResolvedValue({
      greeting: 'Dear Hiring Team,',
      opening: 'Opening line.',
      profile_intro: 'Intro line.',
      achievements: [{ lead: 'Cut p99 latency', impact: '40% improvement' }],
      closing: 'Thank you.',
    })

    const payload = await generateCoverLetter(job, resumeEntities, profile, 'user-1')

    expect(payload.candidate.name).toBe('Priya Sharma')
    expect(payload.candidate.email).toBe('priya@example.com')
    expect(payload.letter.role_title).toBe('Senior Backend Engineer')
    expect(payload.letter.company).toBe('Acme')
    expect(payload.letter.opening).toBe('Opening line.')
    expect(payload.letter.achievements).toEqual([{ lead: 'Cut p99 latency', impact: '40% improvement' }])
  })

  it('propagates a generation failure instead of silently returning a broken payload', async () => {
    mockGenerateJson.mockRejectedValue(new Error('AI returned malformed JSON'))
    await expect(generateCoverLetter(job, resumeEntities, profile, 'user-1')).rejects.toThrow('AI returned malformed JSON')
  })

  it('works without a candidate profile (falls back to generic target context)', async () => {
    mockGenerateJson.mockResolvedValue({ opening: 'O', profile_intro: 'P', achievements: [], closing: 'C' })
    await generateCoverLetter(job, resumeEntities, null, 'user-1')
    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('general professional roles')
  })
})
