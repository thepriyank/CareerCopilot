import { generateJson } from './anthropicClient'
import { logger } from '../../utils/logger'

export type LinkedInSectionKey = 'headline' | 'about' | 'experience' | 'skills'

export interface LinkedInProfileInput {
  headline?: string
  about?: string
  experience?: string
  skills?: string
}

export interface LinkedInSectionFeedback {
  score: number
  narrative: string
}

export interface LinkedInReviewResult {
  overallScore: number
  sections: Partial<Record<LinkedInSectionKey, LinkedInSectionFeedback>>
  headlineRewrites: { label: string; text: string }[]
}

const REVIEW_PROMPT = `
You are a recruiter-eyes LinkedIn profile reviewer. The candidate has pasted the sections of their real LinkedIn profile below. Give honest, specific feedback — not generic encouragement.

{SECTIONS}

Rules:
1. For each section provided above, give a 0-100 "strength" score and a short (2-3 sentence) narrative explaining what a recruiter would notice, in terms of scope, outcomes, and keyword coverage for the candidate's likely target roles.
2. If a "headline" section was provided, suggest 2-3 alternative headline rewrites that better signal scope/impact. Use ONLY facts, employers, and numbers already present in the sections above — do NOT invent companies, titles, or metrics that were not stated.
3. Return ONLY valid JSON in this exact shape (omit a section key entirely if it wasn't provided above):
{
  "overallScore": <0-100 average across provided sections>,
  "sections": {
    "headline": { "score": <number>, "narrative": "<string>" },
    "about": { "score": <number>, "narrative": "<string>" },
    "experience": { "score": <number>, "narrative": "<string>" },
    "skills": { "score": <number>, "narrative": "<string>" }
  },
  "headlineRewrites": [{ "label": "<short style label>", "text": "<rewritten headline>" }]
}
`

export async function reviewLinkedInProfile(
  input: LinkedInProfileInput,
  userId: string
): Promise<LinkedInReviewResult> {
  logger.info(`Reviewing LinkedIn profile for user ${userId}`)

  const sectionsText = (Object.entries(input) as [LinkedInSectionKey, string | undefined][])
    .filter(([, value]) => !!value?.trim())
    .map(([key, value]) => `## ${key}\n${value}`)
    .join('\n\n')

  const prompt = REVIEW_PROMPT.replace('{SECTIONS}', sectionsText)

  try {
    const result = await generateJson<LinkedInReviewResult>(prompt, {
      userId,
      feature: 'linkedin_review',
    })
    const sections = result.sections ?? {}

    // Compute the average ourselves from the per-section scores rather than
    // trust the model's self-reported "overallScore" — free-tier models are
    // weaker at precise arithmetic than at describing what they see, and its
    // number isn't always consistent with the section scores it just gave.
    // This also guarantees a whole number: overallScore is a DB integer
    // column, and an odd split (e.g. 70 + 75) averaged directly would produce
    // 72.5 and fail the insert.
    const sectionScores = Object.values(sections)
      .map((s) => s?.score)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    const overallScore =
      sectionScores.length > 0
        ? Math.round(sectionScores.reduce((sum, n) => sum + n, 0) / sectionScores.length)
        : Math.round(result.overallScore ?? 0)

    return {
      overallScore,
      sections,
      headlineRewrites: result.headlineRewrites ?? [],
    }
  } catch (err) {
    logger.error('LinkedIn review failed', { err: (err as Error).message })
    throw err
  }
}
