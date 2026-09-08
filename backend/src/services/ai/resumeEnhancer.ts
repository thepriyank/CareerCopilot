import { generateJson } from './anthropicClient'
import { ExtractedEntities } from '../../types'
import { CandidateProfile } from '../../entities/CandidateProfile'
import { logger } from '../../utils/logger'

const ENHANCEMENT_PROMPT = `
You are an expert resume writer and career coach. Your task is to enhance the provided resume content to make it an ATS-friendly, impact-focused "Master Resume".
The candidate is targeting the following roles: {TARGET_ROLES}.

Rules for enhancement:
1. SUMMARY: Write a professional summary that aligns with their target roles. Keep it concise, engaging, and professional.
2. EXPERIENCE BULLETS: Rewrite the bullet points using the STAR (Situation, Task, Action, Result) method and strong action verbs.
3. TRUTHFULNESS: Do NOT invent metrics, skills, tools, or experiences that are not present in the original text. If there are no metrics, focus on the action and outcome described.
4. Return ONLY the rewritten summary and bullets — do not repeat skills, education, contact info, or any other unchanged field back.

Return JSON in exactly this shape (one entry per experience item below, matching by "id"):
{"summary": "...", "experience": [{"id": "...", "bullets": ["...", "..."]}]}

Candidate's experience items (id, company, title, original bullets):
{EXPERIENCE_JSON}

Original summary:
{ORIGINAL_SUMMARY}
`

interface EnhancementResult {
  summary?: string
  experience?: Array<{ id: string; bullets: string[] }>
}

export async function enhanceResume(
  parsedEntities: ExtractedEntities,
  profile: CandidateProfile,
  userId: string
): Promise<ExtractedEntities> {
  logger.info(`Enhancing resume for user ${userId}`)

  const targetRoles = profile.targetRoles.length > 0
    ? profile.targetRoles.join(', ')
    : 'general professional roles'

  // Only send/request what the model actually needs to rewrite — echoing the
  // full resume (skills, education, contact info) back through the model
  // wastes tokens and, on a real multi-job resume, was pushing the response
  // past maxTokens and truncating mid-JSON.
  const experienceInput = parsedEntities.experience.map((exp) => ({
    id: exp.id,
    company: exp.company,
    title: exp.title,
    bullets: exp.bullets,
  }))

  const prompt = ENHANCEMENT_PROMPT
    .replace('{TARGET_ROLES}', targetRoles)
    .replace('{EXPERIENCE_JSON}', JSON.stringify(experienceInput, null, 2))
    .replace('{ORIGINAL_SUMMARY}', parsedEntities.summary ?? '(none provided)')

  try {
    const enhanced = await generateJson<EnhancementResult>(prompt, {
      userId,
      feature: 'master_resume_enhancement',
      maxTokens: 8192,
    })

    return {
      ...parsedEntities,
      summary: enhanced.summary ?? parsedEntities.summary,
      experience: parsedEntities.experience.map(originalExp => {
        const enhancedExp = enhanced.experience?.find(e => e.id === originalExp.id)
        return {
          ...originalExp,
          bullets: enhancedExp?.bullets ?? originalExp.bullets
        }
      })
    }
  } catch (err) {
    logger.error('Resume enhancement failed', { err: (err as Error).message })
    throw err
  }
}

const REGENERATE_PROMPT = `
You are an expert resume writer. The user wants to change a specific bullet point on their resume.
Original bullet point context:
"{ORIGINAL_TEXT}"

Current bullet point text:
"{CURRENT_TEXT}"

User's instruction for improvement:
"{INSTRUCTION}"

Rules:
1. Return ONLY valid JSON with a single key "enhancedText" containing the rewritten string.
2. Do NOT add new skills or metrics that are not in the original text.
3. Keep it professional and ATS-friendly.
`

export async function regenerateSection(
  originalText: string,
  currentText: string,
  instruction: string,
  userId: string
): Promise<string> {
  logger.info(`Regenerating section for user ${userId}`)

  const prompt = REGENERATE_PROMPT
    .replace('{ORIGINAL_TEXT}', originalText)
    .replace('{CURRENT_TEXT}', currentText)
    .replace('{INSTRUCTION}', instruction)

  try {
    const response = await generateJson<{ enhancedText: string }>(prompt, {
      userId,
      feature: 'master_resume_regeneration',
    })
    return response.enhancedText
  } catch (err) {
    logger.error('Section regeneration failed', { err: (err as Error).message })
    throw err
  }
}
