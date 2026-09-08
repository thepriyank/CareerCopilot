import { detectSections } from './sectionDetector'
import { extractEntities, computeConfidenceScores } from './entityExtractor'
import { ParsedResumeData } from '../../types'
import { logger } from '../../utils/logger'

// Dynamic imports to handle packages that may not have proper TS types
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (
    buffer: Buffer
  ) => Promise<{ text: string; numpages: number }>
  const result = await pdfParse(buffer)
  return result.text
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
  }
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export type SupportedFileType = 'PDF' | 'DOCX'

export interface ParseOptions {
  userId?: string
  userApiKey?: string
}

export async function parseResume(
  fileBuffer: Buffer,
  fileType: SupportedFileType,
  options: ParseOptions = {}
): Promise<ParsedResumeData> {
  logger.debug(`Parsing resume fileType=${fileType} sizeBytes=${fileBuffer.length}`)

  let rawText: string
  try {
    rawText =
      fileType === 'PDF' ? await extractPdfText(fileBuffer) : await extractDocxText(fileBuffer)
  } catch (err) {
    logger.error('Text extraction failed', { err: (err as Error).message, fileType })
    throw new Error(`Failed to extract text from ${fileType} file: ${(err as Error).message}`)
  }

  if (!rawText || rawText.trim().length < 20) {
    // Likely an image-based PDF or corrupted file
    return {
      sections: [],
      extractedEntities: {
        contact: {},
        experience: [],
        education: [],
        skills: [],
        certifications: [],
        projects: [],
      },
      confidenceScores: {
        overall: 0,
        name: 0,
        email: 0,
        phone: 0,
        experience: 0,
        education: 0,
        skills: 0,
      },
      rawText: '',
    }
  }

  const sections = detectSections(rawText)
  const extractedEntities = await extractEntities(rawText, options)
  const confidenceScores = computeConfidenceScores(extractedEntities)

  logger.debug(`Parsing complete overallConfidence=${confidenceScores.overall}`)

  return { sections, extractedEntities, confidenceScores, rawText }
}
