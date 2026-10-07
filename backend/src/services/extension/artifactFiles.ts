/**
 * Turns a resolved résumé / cover letter (see resolveArtifacts.ts — which
 * already enforces approved-only) into the actual file the extension
 * attaches to an employer's form (NM-4).
 *
 * File names are what the *employer* sees, so they're named after the
 * candidate ("Priya_Sharma_Resume.pdf"), not after the job — the per-job
 * "resume_<Job Title>.pdf" naming is only for the user's own Downloads
 * folder (web app, jobs/[id]/page.tsx).
 */

import { AppDataSource } from '../../config/dataSource'
import { GeneratedResumeVersion } from '../../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../entities/GeneratedCoverLetter'
import { ResumeFile } from '../../entities/ResumeFile'
import { FileType } from '../../entities/enums'
import { buildResumeHtml } from '../documents/resumeTemplate'
import { buildCoverLetterHtml, CoverLetterPayload } from '../documents/coverLetterTemplate'
import { renderHtmlToPdf } from '../documents/renderPdf'
import { filenameFromUrl, readDecryptedFile } from '../storage/fileStorage'
import type { ExtractedEntities } from '../../types'
import type { ResolvedResume } from './resolveArtifacts'

export interface ArtifactFile {
  buffer: Buffer
  filename: string
  mimeType: string
}

const PDF = 'application/pdf'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * A filesystem- and header-safe file name part: drops characters invalid on
 * Windows/macOS/Linux and control characters, turns whitespace into
 * underscores, and caps the length. Empty input → empty string.
 */
export function safeFilenamePart(value: string | null | undefined, maxLength = 60): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents so the name survives every ATS
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, maxLength)
    .replace(/^[._]+|[._]+$/g, '')
}

function candidateFilename(candidateName: string | null, kind: 'Resume' | 'Cover_Letter', ext: string): string {
  const name = safeFilenamePart(candidateName)
  return `${name ? `${name}_` : ''}${kind}.${ext}`
}

/** File bytes for an already-resolved (approved-only) résumé, or null if it's gone. */
export async function resumeFileFor(
  userId: string,
  resolved: ResolvedResume,
  candidateName: string | null
): Promise<ArtifactFile | null> {
  if (resolved.type === 'ORIGINAL') {
    const file = await AppDataSource.getRepository(ResumeFile).findOneBy({ id: resolved.id, userId })
    if (!file) return null
    const isPdf = file.fileType === FileType.PDF
    return {
      buffer: await readDecryptedFile(filenameFromUrl(file.fileUrl)),
      filename: candidateFilename(candidateName, 'Resume', isPdf ? 'pdf' : 'docx'),
      mimeType: isPdf ? PDF : DOCX,
    }
  }

  const version = await AppDataSource.getRepository(GeneratedResumeVersion).findOneBy({ id: resolved.id, userId })
  if (!version) return null
  const html = buildResumeHtml(version.content as unknown as ExtractedEntities)
  return {
    buffer: await renderHtmlToPdf(html, { format: 'a4' }),
    filename: candidateFilename(candidateName, 'Resume', 'pdf'),
    mimeType: PDF,
  }
}

/** PDF bytes for an already-resolved (approved-only) cover letter, or null if it's gone. */
export async function coverLetterFileFor(
  userId: string,
  coverLetterId: string,
  candidateName: string | null
): Promise<ArtifactFile | null> {
  const letter = await AppDataSource.getRepository(GeneratedCoverLetter).findOneBy({ id: coverLetterId, userId })
  if (!letter) return null
  const html = buildCoverLetterHtml(letter.content as unknown as CoverLetterPayload)
  return {
    buffer: await renderHtmlToPdf(html, { format: 'a4' }),
    filename: candidateFilename(candidateName, 'Cover_Letter', 'pdf'),
    mimeType: PDF,
  }
}

/**
 * The cover letter as plain text, for forms whose "cover letter" field is a
 * textarea rather than a file upload. Same content as the PDF minus layout
 * and footnotes.
 */
export function coverLetterPlainText(payload: CoverLetterPayload): string {
  const l = payload?.letter
  if (!l) return ''
  const paragraphs: string[] = []
  if (l.greeting) paragraphs.push(l.greeting)
  if (l.opening) paragraphs.push(l.opening)
  if (l.profile_intro) paragraphs.push(l.profile_intro)
  if (l.achievements?.length) {
    paragraphs.push(l.achievements.map((a) => `• ${a.lead}${a.impact ? ` — ${a.impact}` : ''}`).join('\n'))
  }
  if (l.problems_section) paragraphs.push(l.problems_section)
  if (l.closing) paragraphs.push(l.closing)
  if (l.language_closing) paragraphs.push(l.language_closing)
  if (payload.candidate?.name) paragraphs.push(payload.candidate.name)
  return paragraphs.map((p) => p.trim()).filter(Boolean).join('\n\n')
}

/** Approved cover letter text for the fill payload, or null. */
export async function coverLetterTextFor(userId: string, coverLetterId: string): Promise<string | null> {
  const letter = await AppDataSource.getRepository(GeneratedCoverLetter).findOneBy({ id: coverLetterId, userId })
  if (!letter) return null
  return coverLetterPlainText(letter.content as unknown as CoverLetterPayload) || null
}
