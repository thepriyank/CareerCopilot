import { reviewLinkedInProfile } from '../../src/services/ai/linkedinReviewer'
import { generateJson } from '../../src/services/ai/anthropicClient'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockGenerateJson = generateJson as jest.Mock

beforeEach(() => {
  mockGenerateJson.mockReset()
})

describe('reviewLinkedInProfile', () => {
  it('builds a prompt containing only the provided sections and the no-fabrication rule', async () => {
    mockGenerateJson.mockResolvedValue({ overallScore: 70, sections: {}, headlineRewrites: [] })

    await reviewLinkedInProfile({ headline: 'Senior Backend Engineer @ Acme', about: undefined }, 'user-1')

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('## headline')
    expect(prompt).toContain('Senior Backend Engineer @ Acme')
    expect(prompt).not.toContain('## about')
    expect(prompt).toContain('do NOT invent companies, titles, or metrics')
  })

  it('returns the parsed sections, score, and rewrites', async () => {
    mockGenerateJson.mockResolvedValue({
      overallScore: 62,
      sections: { headline: { score: 62, narrative: 'Generic value claim.' } },
      headlineRewrites: [{ label: 'Outcome-first', text: 'Cut p99 latency by 40% · Backend Engineer' }],
    })

    const result = await reviewLinkedInProfile({ headline: 'Backend Engineer' }, 'user-1')

    expect(result.overallScore).toBe(62)
    expect(result.sections.headline?.narrative).toBe('Generic value claim.')
    expect(result.headlineRewrites).toEqual([{ label: 'Outcome-first', text: 'Cut p99 latency by 40% · Backend Engineer' }])
  })

  it('computes overallScore as a rounded average of the section scores, ignoring a fractional model-reported value', async () => {
    // overallScore is a DB integer column — a model that reports its own
    // (correct) 72.5 average, or one whose self-reported average disagrees
    // with the section scores it just gave, must never reach the caller as
    // a non-integer or as an unverified number.
    mockGenerateJson.mockResolvedValue({
      overallScore: 72.5,
      sections: {
        headline: { score: 70, narrative: 'a' },
        about: { score: 75, narrative: 'b' },
      },
      headlineRewrites: [],
    })

    const result = await reviewLinkedInProfile({ headline: 'x', about: 'y' }, 'user-1')

    expect(result.overallScore).toBe(73) // round((70 + 75) / 2) = round(72.5) = 73
    expect(Number.isInteger(result.overallScore)).toBe(true)
  })

  it('defaults to empty sections/rewrites if the model omits them', async () => {
    mockGenerateJson.mockResolvedValue({ overallScore: 50 })
    const result = await reviewLinkedInProfile({ headline: 'Engineer' }, 'user-1')
    expect(result.sections).toEqual({})
    expect(result.headlineRewrites).toEqual([])
  })

  it('propagates a generation failure', async () => {
    mockGenerateJson.mockRejectedValue(new Error('AI returned malformed JSON'))
    await expect(reviewLinkedInProfile({ headline: 'X' }, 'user-1')).rejects.toThrow('AI returned malformed JSON')
  })
})
