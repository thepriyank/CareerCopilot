import { extractJobSkills, flattenJobSkills } from '../../src/services/skills/extractJobSkills'
import { generateJson } from '../../src/services/ai/anthropicClient'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockGenerateJson = generateJson as jest.Mock

beforeEach(() => {
  mockGenerateJson.mockReset()
})

describe('extractJobSkills', () => {
  // Regression guard for the 2026-09-06 prompt tightening — live testing
  // surfaced full duty sentences, eligibility filler ("reliable
  // transportation"), and un-split compound phrases coming back as
  // "skills". This doesn't prove the model complies, just that the
  // instructions asking it to exclude/split them haven't been edited away.
  it('instructs the model to exclude duties/eligibility filler and split compound skill phrases', async () => {
    mockGenerateJson.mockResolvedValue({ requiredSkills: [], niceToHaveSkills: [], seniorityLevel: null })
    await extractJobSkills('some JD text')

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('split them into SEPARATE individual entries')
    expect(prompt).toContain('job responsibilities or duties')
    expect(prompt).toContain('reliable transportation')
    expect(prompt).toContain('self-motivated')
  })

  it('returns the required/nice-to-have/seniority split the model provides', async () => {
    mockGenerateJson.mockResolvedValue({
      requiredSkills: ['Python', 'Kubernetes'],
      niceToHaveSkills: ['Rust'],
      seniorityLevel: 'Senior',
    })

    const result = await extractJobSkills('some JD text')

    expect(result).toEqual({
      requiredSkills: ['Python', 'Kubernetes'],
      niceToHaveSkills: ['Rust'],
      seniorityLevel: 'Senior',
    })
  })

  it('dedupes case-insensitively while preserving first-seen casing', async () => {
    mockGenerateJson.mockResolvedValue({
      requiredSkills: ['Python', 'python', 'PYTHON', '  Python  '],
      niceToHaveSkills: [],
      seniorityLevel: null,
    })

    const result = await extractJobSkills('some JD text')
    expect(result.requiredSkills).toEqual(['Python'])
  })

  it('treats a blank/whitespace seniorityLevel as null', async () => {
    mockGenerateJson.mockResolvedValue({ requiredSkills: [], niceToHaveSkills: [], seniorityLevel: '   ' })
    const result = await extractJobSkills('some JD text')
    expect(result.seniorityLevel).toBeNull()
  })

  it('falls back to the regex extractor (as required skills) when every LLM provider fails', async () => {
    mockGenerateJson.mockRejectedValue(new Error('Every LLM provider in the chain failed for this call'))

    const result = await extractJobSkills('## Requirements\n- Python\n- Kubernetes\n')

    expect(result.requiredSkills).toEqual(expect.arrayContaining(['Python', 'Kubernetes']))
    expect(result.niceToHaveSkills).toEqual([])
    expect(result.seniorityLevel).toBeNull()
  })

  it('passes userId through for model-usage tracking', async () => {
    mockGenerateJson.mockResolvedValue({ requiredSkills: [], niceToHaveSkills: [], seniorityLevel: null })
    await extractJobSkills('some JD text', { userId: 'user-1' })
    expect(mockGenerateJson).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: 'user-1', feature: 'job_skill_extraction' })
    )
  })
})

describe('flattenJobSkills', () => {
  it('unions required and nice-to-have, deduped', () => {
    const flat = flattenJobSkills({
      requiredSkills: ['Python', 'Kubernetes'],
      niceToHaveSkills: ['Kubernetes', 'Rust'],
      seniorityLevel: null,
    })
    expect(flat).toEqual(['Python', 'Kubernetes', 'Rust'])
  })
})
