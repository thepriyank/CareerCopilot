/**
 * Download names for a job's tailored documents (NM-4): `resume_<Job Title>.pdf`
 * and `cover_<Job Title>.pdf`, so several applications' files stay
 * distinguishable in the user's Downloads folder instead of overwriting one
 * another as `tailored-resume.pdf`.
 *
 * (Files the browser extension attaches on employer sites are named after
 * the candidate instead — see backend services/extension/artifactFiles.ts.)
 */
export function safeFilenamePart(value: string | null | undefined, maxLength = 80): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, maxLength)
    .replace(/^[._]+|[._]+$/g, '')
}

export function jobDocumentFilename(kind: 'resume' | 'cover', jobTitle: string | null | undefined): string {
  const title = safeFilenamePart(jobTitle)
  return `${kind}${title ? `_${title}` : ''}.pdf`
}
