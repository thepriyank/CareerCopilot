import { generateJson } from '../../src/services/ai/anthropicClient'

jest.mock('../../src/services/ai/anthropicClient', () => ({
  generateJson: jest.fn(),
}))

const mockPdfParse = jest.fn()
jest.mock('pdf-parse', () => (buffer: Buffer) => mockPdfParse(buffer))

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { extractLinkedInProfileFromPdf } from '../../src/services/ai/linkedinPdfExtractor'

const mockGenerateJson = generateJson as jest.Mock

beforeEach(() => {
  mockGenerateJson.mockReset()
  mockPdfParse.mockReset()
})

describe('extractLinkedInProfileFromPdf', () => {
  it('extracts the four fields from the AI response, feeding it the raw PDF text', async () => {
    mockPdfParse.mockResolvedValue({ text: 'Jane Doe\nSenior Backend Engineer @ Acme\n\nSummary\nBuilds payments infra.\n\nTop Skills\nNode.js, TypeScript' })
    mockGenerateJson.mockResolvedValue({
      headline: 'Senior Backend Engineer @ Acme',
      about: 'Builds payments infra.',
      experience: 'Senior Backend Engineer, Acme',
      skills: 'Node.js, TypeScript',
    })

    const result = await extractLinkedInProfileFromPdf(Buffer.from('fake-pdf'), 'user-1')

    expect(result.headline).toBe('Senior Backend Engineer @ Acme')
    expect(result.about).toBe('Builds payments infra.')
    expect(result.skills).toBe('Node.js, TypeScript')
    expect(result.rawTextLength).toBeGreaterThan(0)

    const [prompt] = mockGenerateJson.mock.calls[0]
    expect(prompt).toContain('Top Skills')
    expect(prompt).toContain('do NOT fabricate')
  })

  it('defaults missing fields to empty strings rather than undefined', async () => {
    mockPdfParse.mockResolvedValue({ text: 'Some real profile text that is long enough to pass the length check' })
    mockGenerateJson.mockResolvedValue({ headline: 'Engineer' })

    const result = await extractLinkedInProfileFromPdf(Buffer.from('fake-pdf'), 'user-1')

    expect(result.about).toBe('')
    expect(result.experience).toBe('')
    expect(result.skills).toBe('')
  })

  it('rejects a PDF with no extractable text (e.g. a scanned image) before ever calling the AI', async () => {
    mockPdfParse.mockResolvedValue({ text: '   ' })

    await expect(extractLinkedInProfileFromPdf(Buffer.from('fake-pdf'), 'user-1')).rejects.toThrow('no readable text')
    expect(mockGenerateJson).not.toHaveBeenCalled()
  })

  it('wraps a pdf-parse failure in a clear message', async () => {
    mockPdfParse.mockRejectedValue(new Error('not a PDF'))

    await expect(extractLinkedInProfileFromPdf(Buffer.from('fake-pdf'), 'user-1')).rejects.toThrow('Could not read this PDF')
  })

  it('propagates an AI generation failure', async () => {
    mockPdfParse.mockResolvedValue({ text: 'Some real profile text that is long enough to pass the length check' })
    mockGenerateJson.mockRejectedValue(new Error('AI returned malformed JSON'))

    await expect(extractLinkedInProfileFromPdf(Buffer.from('fake-pdf'), 'user-1')).rejects.toThrow('AI returned malformed JSON')
  })
})
