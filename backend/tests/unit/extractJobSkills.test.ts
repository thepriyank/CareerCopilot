import { extractJobSkills, flattenJobSkills, JobSkillsExtraction } from '../../src/services/skills/extractJobSkills'
import { generateJson } from '../../src/services/ai/anthropicClient'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockGenerateJson = generateJson as jest.Mock

const emptyRaw: JobSkillsExtraction = {
  requiredSkills: [],
  niceToHaveSkills: [],
  seniorityLevel: null,
  seniorityTier: 'mid',
  minYearsExperience: null,
  maxYearsExperience: null,
  salaryMin: null,
  salaryMax: null,
  salaryCurrency: null,
}

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
    mockGenerateJson.mockResolvedValue(emptyRaw)
    await extractJobSkills('some JD text')

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('split them into SEPARATE individual entries')
    expect(prompt).toContain('job responsibilities or duties')
    expect(prompt).toContain('reliable transportation')
    expect(prompt).toContain('self-motivated')
  })

  // 2026-09-21: seniority/years/salary are judged by the LLM from title +
  // description together, in this same call — not a second regex pass.
  it('instructs the model to judge seniority holistically and extract years/salary, and includes the title/known-salary context', async () => {
    mockGenerateJson.mockResolvedValue(emptyRaw)
    await extractJobSkills('some JD text', { title: 'Staff Engineer', knownSalaryText: '12,00,000 - 18,00,000' })

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('Staff Engineer')
    expect(prompt).toContain('12,00,000 - 18,00,000')
    expect(prompt).toContain('not from the title alone')
    expect(prompt).toContain('minYearsExperience')
    expect(prompt).toContain('salaryCurrency')
  })

  it('returns the full extraction the model provides', async () => {
    mockGenerateJson.mockResolvedValue({
      requiredSkills: ['Python', 'Kubernetes'],
      niceToHaveSkills: ['Rust'],
      seniorityLevel: 'Staff',
      seniorityTier: 'staff',
      minYearsExperience: 8,
      maxYearsExperience: 12,
      salaryMin: 4000000,
      salaryMax: 5500000,
      salaryCurrency: 'inr',
    })

    const result = await extractJobSkills('some JD text', { title: 'Staff Engineer' })

    expect(result).toEqual({
      requiredSkills: ['Python', 'Kubernetes'],
      niceToHaveSkills: ['Rust'],
      seniorityLevel: 'Staff',
      seniorityTier: 'staff',
      minYearsExperience: 8,
      maxYearsExperience: 12,
      salaryMin: 4000000,
      salaryMax: 5500000,
      salaryCurrency: 'INR',
    })
  })

  it('dedupes case-insensitively while preserving first-seen casing', async () => {
    mockGenerateJson.mockResolvedValue({
      ...emptyRaw,
      requiredSkills: ['Python', 'python', 'PYTHON', '  Python  '],
    })

    const result = await extractJobSkills('some JD text')
    expect(result.requiredSkills).toEqual(['Python'])
  })

  it('treats a blank/whitespace seniorityLevel as null', async () => {
    mockGenerateJson.mockResolvedValue({ ...emptyRaw, seniorityLevel: '   ' })
    const result = await extractJobSkills('some JD text')
    expect(result.seniorityLevel).toBeNull()
  })

  it('falls back to classifyTier(title) when the model omits/invents an invalid seniorityTier', async () => {
    mockGenerateJson.mockResolvedValue({ ...emptyRaw, seniorityTier: 'ultra-senior-wizard' })
    const result = await extractJobSkills('some JD text', { title: 'Staff Engineer' })
    expect(result.seniorityTier).toBe('staff')
  })

  it('treats an explicit null (not just a missing key) as null, not 0 — Number(null) is 0, a real bug risk', async () => {
    mockGenerateJson.mockResolvedValue({
      ...emptyRaw,
      minYearsExperience: null,
      maxYearsExperience: null,
      salaryMin: null,
      salaryMax: null,
    })
    const result = await extractJobSkills('some JD text')
    expect(result.minYearsExperience).toBeNull()
    expect(result.maxYearsExperience).toBeNull()
    expect(result.salaryMin).toBeNull()
    expect(result.salaryMax).toBeNull()
  })

  it('rejects out-of-range or non-numeric years/salary values rather than passing them through', async () => {
    mockGenerateJson.mockResolvedValue({
      ...emptyRaw,
      minYearsExperience: 999,
      maxYearsExperience: 'a lot',
      salaryMin: -5,
      salaryMax: 'competitive',
    })
    const result = await extractJobSkills('some JD text')
    expect(result.minYearsExperience).toBeNull()
    expect(result.maxYearsExperience).toBeNull()
    expect(result.salaryMin).toBeNull()
    expect(result.salaryMax).toBeNull()
  })

  it('falls back to the regex extractor + classifyTier(title) when every LLM provider fails, leaving years/salary null', async () => {
    mockGenerateJson.mockRejectedValue(new Error('Every LLM provider in the chain failed for this call'))

    const result = await extractJobSkills('## Requirements\n- Python\n- Kubernetes\n', { title: 'Staff Engineer' })

    expect(result.requiredSkills).toEqual(expect.arrayContaining(['Python', 'Kubernetes']))
    expect(result.niceToHaveSkills).toEqual([])
    expect(result.seniorityLevel).toBeNull()
    expect(result.seniorityTier).toBe('staff')
    expect(result.minYearsExperience).toBeNull()
    expect(result.maxYearsExperience).toBeNull()
    expect(result.salaryMin).toBeNull()
    expect(result.salaryCurrency).toBeNull()
  })

  it('passes userId through for model-usage tracking', async () => {
    mockGenerateJson.mockResolvedValue(emptyRaw)
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
      ...emptyRaw,
      requiredSkills: ['Python', 'Kubernetes'],
      niceToHaveSkills: ['Kubernetes', 'Rust'],
    })
    expect(flat).toEqual(['Python', 'Kubernetes', 'Rust'])
  })
})
