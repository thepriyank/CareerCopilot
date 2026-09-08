import { tailorResume } from '../../src/services/ai/resumeTailorer'
import { generateJson } from '../../src/services/ai/anthropicClient'
import { JobView } from '../../src/services/jobs/jobView'
import { ExtractedEntities } from '../../src/types'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockGenerateJson = generateJson as jest.Mock

const job = {
  id: 'job-1',
  title: 'Senior Backend Engineer',
  description: '## Requirements\n- Python\n- Kubernetes\n- Rust\n',
} as JobView

const masterEntities: ExtractedEntities = {
  contact: { name: 'Priya Sharma', email: 'priya@example.com' },
  summary: 'Backend engineer with 6 years of experience.',
  experience: [
    {
      id: '1',
      company: 'Beta Corp',
      title: 'Backend Engineer',
      bullets: ['Cut p99 latency by 40% on the payments service', 'Mentored two junior engineers'],
    },
  ],
  education: [],
  skills: [{ id: '1', name: 'Python' }],
  certifications: [],
  projects: [],
}

const skillGap = { existing: ['Python'], supportedByResume: ['Kubernetes'], gap: ['Rust'] }

beforeEach(() => {
  mockGenerateJson.mockReset()
})

describe('tailorResume', () => {
  it('builds a prompt containing the JD, the classified skills, and the no-fabrication rule', async () => {
    mockGenerateJson.mockResolvedValue({ summary: 'Tailored summary.', experience: [] })

    await tailorResume(masterEntities, job, skillGap, 'user-1')

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('Senior Backend Engineer')
    expect(prompt).toContain('Python')
    expect(prompt).toContain('Kubernetes')
    expect(prompt).toContain('do NOT invent metrics, tools, employers')
  })

  it('accepts a rewritten summary and reordered bullets from the model', async () => {
    mockGenerateJson.mockResolvedValue({
      summary: 'Tailored for backend infra roles.',
      experience: [{ id: '1', company: 'Beta Corp', bullets: ['Mentored two junior engineers', 'Cut p99 latency by 40% on the payments service'] }],
    })

    const result = await tailorResume(masterEntities, job, skillGap, 'user-1')

    expect(result.summary).toBe('Tailored for backend infra roles.')
    expect(result.experience[0].bullets).toEqual([
      'Mentored two junior engineers',
      'Cut p99 latency by 40% on the payments service',
    ])
  })

  it('rejects a model response that invents more bullets than the original role had', async () => {
    mockGenerateJson.mockResolvedValue({
      summary: 'Tailored.',
      experience: [{ id: '1', company: 'Beta Corp', bullets: ['Original 1', 'Original 2', 'Fabricated new bullet'] }],
    })

    const result = await tailorResume(masterEntities, job, skillGap, 'user-1')

    // Falls back to the original bullets for that role instead of accepting an invented one.
    expect(result.experience[0].bullets).toEqual(masterEntities.experience[0].bullets)
  })

  it('propagates a generation failure instead of silently returning the original resume', async () => {
    mockGenerateJson.mockRejectedValue(new Error('AI returned malformed JSON'))
    await expect(tailorResume(masterEntities, job, skillGap, 'user-1')).rejects.toThrow('AI returned malformed JSON')
  })
})
