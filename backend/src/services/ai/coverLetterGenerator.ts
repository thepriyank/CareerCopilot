import { generateJson } from './anthropicClient'
import { ExtractedEntities } from '../../types'
import { CandidateProfile } from '../../entities/CandidateProfile'
import { JobView } from '../jobs/jobView'
import { CoverLetterPayload, CoverLetterAchievement } from '../documents/coverLetterTemplate'
import { logger } from '../../utils/logger'

/**
 * Fact/generation separation (per CLAUDE.md §4): the candidate's contact
 * details and the job's own fields are taken verbatim from already-verified
 * data (never sent through the model to be reproduced) — only the letter's
 * narrative prose is generated, and it's generated strictly from the
 * candidate facts handed to the prompt below.
 */

const COVER_LETTER_PROMPT = `
You are an expert cover letter writer. Write the narrative content of a cover letter for this candidate applying to this specific role.

Role: {ROLE_TITLE} at {COMPANY}
Job description:
{JOB_DESCRIPTION}

Candidate facts (this is the ONLY source of truth about the candidate — do not use anything else):
{CANDIDATE_FACTS}

Candidate's target roles/industries (for tone/context only, not a source of new facts): {TARGET_CONTEXT}

Rules:
1. TRUTHFULNESS: Do NOT invent employers, job titles, skills, tools, or achievements that are not present in the candidate facts above. Every claim must trace back to something literally stated there.
2. Reference specific requirements from the job description to explain why this candidate fits — but only where a real candidate fact actually supports the connection.
3. "achievements": pick up to 3 real achievements drawn directly from the candidate's experience bullets. "lead" is a short label (a few words), "impact" is the outcome, taken from or closely paraphrasing the real bullet — never fabricated or exaggerated beyond what the bullet states.
4. Keep the tone professional and concise — this is one page of content.
5. Return ONLY valid JSON with this exact structure, no markdown fences:
{"greeting": "string or null", "opening": "string", "profile_intro": "string", "achievements": [{"lead": "string", "impact": "string"}], "closing": "string"}
`

interface RawCoverLetterContent {
  greeting?: string | null
  opening?: string
  profile_intro?: string
  achievements?: CoverLetterAchievement[]
  closing?: string
}

function formatCandidateFacts(entities: ExtractedEntities): string {
  const lines: string[] = []
  if (entities.summary) lines.push(`Summary: ${entities.summary}`)
  for (const exp of entities.experience ?? []) {
    lines.push(`- ${exp.title ?? ''} at ${exp.company ?? ''} (${exp.startDate ?? ''}–${exp.current ? 'Present' : (exp.endDate ?? '')})`)
    for (const bullet of exp.bullets ?? []) {
      lines.push(`  * ${bullet}`)
    }
  }
  const skillNames = (entities.skills ?? []).map((s) => s.name).filter(Boolean)
  if (skillNames.length) lines.push(`Skills: ${skillNames.join(', ')}`)
  return lines.join('\n')
}

export async function generateCoverLetter(
  job: JobView,
  resumeEntities: ExtractedEntities,
  profile: CandidateProfile | null,
  userId: string
): Promise<CoverLetterPayload> {
  logger.info(`Generating cover letter for job ${job.id}, user ${userId}`)

  const prompt = COVER_LETTER_PROMPT
    .replace('{ROLE_TITLE}', job.title)
    .replace('{COMPANY}', job.company ?? 'the company')
    .replace('{JOB_DESCRIPTION}', job.description.slice(0, 8000))
    .replace('{CANDIDATE_FACTS}', formatCandidateFacts(resumeEntities))
    .replace('{TARGET_CONTEXT}', profile?.targetRoles?.length ? profile.targetRoles.join(', ') : 'general professional roles')

  let raw: RawCoverLetterContent
  try {
    raw = await generateJson<RawCoverLetterContent>(prompt, { userId, feature: 'cover_letter_generation' })
  } catch (err) {
    logger.error('Cover letter generation failed', { err: (err as Error).message })
    throw err
  }

  const candidateName = resumeEntities.contact?.name ?? 'Candidate'

  return {
    candidate: {
      name: candidateName,
      location: resumeEntities.contact?.location ?? undefined,
      email: resumeEntities.contact?.email ?? undefined,
      phone: resumeEntities.contact?.phone ?? undefined,
      linkedin: resumeEntities.contact?.linkedin ?? undefined,
    },
    letter: {
      role_title: job.title,
      company: job.company ?? undefined,
      city: job.location ?? undefined,
      date: new Date().toISOString().slice(0, 10),
      greeting: raw.greeting ?? undefined,
      opening: raw.opening ?? '',
      profile_intro: raw.profile_intro ?? '',
      achievements: raw.achievements ?? [],
      closing: raw.closing ?? undefined,
    },
  }
}
