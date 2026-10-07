import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetchArtifact = vi.fn()

vi.mock('../src/background/api', () => ({
  getToken: async () => 'ext_valid',
  setToken: async () => {},
  clearToken: async () => {},
  fetchProfile: vi.fn(),
  requestFill: vi.fn(),
  requestFieldMap: vi.fn(),
  // Vitest 2 fails a test when a vi.fn() itself produces a rejected promise,
  // even if the code under test handles it. So a test that wants a failed
  // fetch makes the mock return an Error value, and this wrapper turns it
  // into the rejection the real fetchArtifact would produce.
  fetchArtifact: (...a: unknown[]) =>
    Promise.resolve(mockFetchArtifact(...a)).then((r) => {
      if (r instanceof Error) throw r
      return r
    }),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message)
    }
  },
}))

import { fillSummary, gatherAttachments } from '../src/background/index'

const PDF = { base64: 'JVBERg==', filename: 'Priya_Sharma_Resume.pdf', mimeType: 'application/pdf' }
const field = (fieldKey: string, type: string) => ({ fieldKey, type, label: null, placeholder: null })

beforeEach(() => mockFetchArtifact.mockReset())

describe('gatherAttachments (NM-4)', () => {
  const fills = {
    job: { id: 'job-1', title: 'Staff Engineer', company: 'Acme' },
    resume: { type: 'TAILORED', id: 'r1', downloadUrl: 'x' },
    coverLetter: { id: 'cl1', downloadUrl: 'x' },
    coverLetterText: 'Dear team,',
  }

  it('fetches the résumé for a file field, for this job', async () => {
    mockFetchArtifact.mockResolvedValue(PDF)
    const a = await gatherAttachments([field('cv', 'file')], [{ fieldKey: 'cv', profileKey: 'resume' }], fills)
    expect(mockFetchArtifact).toHaveBeenCalledWith('resume', 'job-1')
    expect(a.resume).toEqual(PDF)
  })

  it('uses the cover letter text — and fetches no PDF — when the cover-letter field is a textarea', async () => {
    const a = await gatherAttachments([field('cl', 'textarea')], [{ fieldKey: 'cl', profileKey: 'coverLetter' }], fills)
    expect(a.coverLetterText).toBe('Dear team,')
    expect(mockFetchArtifact).not.toHaveBeenCalled()
  })

  it('fetches the cover letter PDF when the cover-letter field is a file input', async () => {
    mockFetchArtifact.mockResolvedValue({ ...PDF, filename: 'Priya_Sharma_Cover_Letter.pdf' })
    const a = await gatherAttachments([field('cl', 'file')], [{ fieldKey: 'cl', profileKey: 'coverLetter' }], fills)
    expect(mockFetchArtifact).toHaveBeenCalledWith('cover-letter', 'job-1')
    expect(a.coverLetterFile?.filename).toBe('Priya_Sharma_Cover_Letter.pdf')
  })

  it('fetches nothing when the form has no document fields, or there is no approved document', async () => {
    await gatherAttachments([field('email', 'email')], [{ fieldKey: 'email', profileKey: 'email' }], fills)
    await gatherAttachments([field('cl', 'file')], [{ fieldKey: 'cl', profileKey: 'coverLetter' }], { ...fills, coverLetter: null })
    expect(mockFetchArtifact).not.toHaveBeenCalled()
  })

  it("doesn't fail the fill when a document can't be fetched", async () => {
    mockFetchArtifact.mockReturnValue(new Error('network'))
    const a = await gatherAttachments([field('cv', 'file')], [{ fieldKey: 'cv', profileKey: 'resume' }], fills)
    expect(a).toEqual({})
  })
})

describe('fillSummary', () => {
  const fills = { resume: { type: 'TAILORED', id: 'r1', downloadUrl: 'x' }, unapprovedTailoredResumeExists: false }

  it('says which documents were attached', () => {
    expect(fillSummary({ filled: 6, mappable: 7, attached: ['resume', 'coverLetter'] }, fills)).toBe(
      'Filled 6 of 7 matched fields, attached your tailored résumé and your cover letter — review before you submit.'
    )
  })

  it('names a master résumé plainly', () => {
    expect(fillSummary({ filled: 3, mappable: 3, attached: ['resume'] }, { ...fills, resume: { type: 'MASTER', id: 'm', downloadUrl: 'x' } }))
      .toBe('Filled 3 of 3 matched fields, attached your résumé — review before you submit.')
  })

  it('nudges about an unapproved tailored résumé', () => {
    expect(fillSummary({ filled: 2, mappable: 2, attached: [] }, { ...fills, unapprovedTailoredResumeExists: true }))
      .toMatch(/unapproved tailored résumé for this job — review it in JobMagnate/)
  })

  it('keeps the screening-questions message when nothing mapped', () => {
    expect(fillSummary({ filled: 0, mappable: 0, attached: [] }, fills)).toMatch(/screening questions/)
  })
})
