import { extractEntities } from '../../src/services/parsing/entityExtractor'
import { generateJson } from '../../src/services/ai/anthropicClient'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockGenerateJson = generateJson as jest.Mock

beforeEach(() => {
  mockGenerateJson.mockReset()
})

describe('extractEntities — totalYearsOfExperience', () => {
  it('instructs the model to compute total years from the résumé\'s own date ranges, not guess', async () => {
    mockGenerateJson.mockResolvedValue({})
    await extractEntities('some resume text')

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('totalYearsOfExperience')
    expect(prompt).toContain("don't double-count overlapping/")
  })

  it('returns the model\'s computed value, rounded', async () => {
    mockGenerateJson.mockResolvedValue({ totalYearsOfExperience: 9.6 })
    const result = await extractEntities('some resume text')
    expect(result.totalYearsOfExperience).toBe(10)
  })

  it('returns null when the model says it cannot compute one', async () => {
    mockGenerateJson.mockResolvedValue({ totalYearsOfExperience: null })
    const result = await extractEntities('some resume text')
    expect(result.totalYearsOfExperience).toBeNull()
  })

  it('rejects an out-of-range or non-numeric value rather than passing it through', async () => {
    mockGenerateJson.mockResolvedValue({ totalYearsOfExperience: 'a decade' })
    const result = await extractEntities('some resume text')
    expect(result.totalYearsOfExperience).toBeNull()
  })

  it('is null when every LLM provider fails, alongside the usual empty-entities fallback', async () => {
    mockGenerateJson.mockRejectedValue(new Error('Every LLM provider in the chain failed for this call'))
    const result = await extractEntities('some resume text')
    expect(result.totalYearsOfExperience).toBeNull()
    expect(result.entities.experience).toEqual([])
  })
})
