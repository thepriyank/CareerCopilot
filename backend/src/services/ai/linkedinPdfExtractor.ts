import { generateJson } from './anthropicClient'
import { logger } from '../../utils/logger'
import type { LinkedInProfileInput } from './linkedinReviewer'

// Dynamic import — same reasoning as resumeParser.ts: pdf-parse doesn't ship
// proper TS types.
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buffer)
  return result.text
}

const EXTRACT_PROMPT = `
You are reading the raw text extracted from a LinkedIn "Save to PDF" profile export (LinkedIn's own official export feature — every profile has a "Save to PDF" button that produces this exact layout). Pull the candidate's real profile content into four plain-text fields, exactly as it appears in the text below.

RAW PDF TEXT:
{RAW_TEXT}

Rules:
1. "headline": the one-line headline shown directly under the person's name at the top (e.g. "Senior Backend Engineer @ Acme | Ex-Google").
2. "about": the "Summary" section's full text, verbatim.
3. "experience": every role's title, company, dates, and bullet points, concatenated as clean plain text — one role after another, close to verbatim, just reflowed into readable lines.
4. "skills": every skill listed anywhere ("Top Skills" and/or a full "Skills" section), comma-separated, deduplicated.
5. If a field genuinely isn't present in the text, return an empty string for it — do NOT fabricate a plausible-sounding placeholder, invent an employer, or invent a skill that isn't literally in the text.
6. Return ONLY valid JSON in this exact shape, no other text:
{
  "headline": "<string>",
  "about": "<string>",
  "experience": "<string>",
  "skills": "<string>"
}
`

export interface LinkedInPdfExtraction extends LinkedInProfileInput {
  rawTextLength: number
}

/**
 * Extracts headline/about/experience/skills from a LinkedIn "Save to PDF"
 * export — the user's own official export of their own profile, not a
 * scrape of a live page. See BRD.md §7.1/§9: LinkedIn's ToS forbid
 * automated access to the live site regardless of a profile's visibility,
 * so this deliberately never fetches a URL — it only reads a file the
 * user downloaded themselves and is now uploading.
 *
 * Returns the same shape `reviewLinkedInProfile` (linkedinReviewer.ts)
 * already accepts, so the caller can show these fields to the user for
 * review/editing before running the existing analysis unchanged.
 */
export async function extractLinkedInProfileFromPdf(
  buffer: Buffer,
  userId: string
): Promise<LinkedInPdfExtraction> {
  logger.debug(`Extracting LinkedIn profile from PDF for user ${userId}`)

  let rawText: string
  try {
    rawText = await extractPdfText(buffer)
  } catch (err) {
    logger.error('LinkedIn PDF text extraction failed', { err: (err as Error).message })
    throw new Error('Could not read this PDF. Make sure it is a LinkedIn "Save to PDF" profile export.')
  }

  if (!rawText || rawText.trim().length < 20) {
    throw new Error('This PDF has no readable text — make sure it is a LinkedIn "Save to PDF" profile export, not a scanned image.')
  }

  const prompt = EXTRACT_PROMPT.replace('{RAW_TEXT}', rawText.slice(0, 15_000))

  try {
    const result = await generateJson<LinkedInProfileInput>(prompt, {
      userId,
      feature: 'linkedin_pdf_extract',
    })

    return {
      headline: result.headline ?? '',
      about: result.about ?? '',
      experience: result.experience ?? '',
      skills: result.skills ?? '',
      rawTextLength: rawText.length,
    }
  } catch (err) {
    logger.error('LinkedIn PDF extraction (AI) failed', { err: (err as Error).message })
    throw err
  }
}
