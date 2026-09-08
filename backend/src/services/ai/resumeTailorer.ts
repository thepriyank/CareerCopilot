import { generateJson } from './anthropicClient'
import { ExtractedEntities } from '../../types'
import { JobView } from '../jobs/jobView'
import { SkillGapClassification } from '../skills/jdSkillGap'
import { logger } from '../../utils/logger'

const TAILOR_PROMPT = `
You are an expert resume writer. Re-emphasize the candidate's EXISTING master resume for a specific job — do not invent anything new.

Job title: {JOB_TITLE}
Job description:
{JOB_DESCRIPTION}

Skills the job asks for that the candidate's resume already demonstrates: {EXISTING_SKILLS}
Skills the job asks for that appear only loosely in the resume's prose (not a named skill): {SUPPORTED_SKILLS}

Rules:
1. SUMMARY: Rewrite the professional summary to foreground the experience most relevant to this specific job. Use only facts already present in the resume below.
2. EXPERIENCE BULLETS: Reorder emphasis and rephrase bullets to surface the achievements most relevant to this job's stated requirements. You may reword for relevance and pull the most relevant bullets earlier within each role, but do NOT invent metrics, tools, employers, or responsibilities that are not already in the original text.
3. Do NOT add skills, employers, degrees, or certifications that are not already present in the resume below, even if the job description asks for them.
4. Return ONLY the rewritten summary and bullets — do not repeat skills, education, contact info, or any other unchanged field back.

Return JSON in exactly this shape (one entry per experience item below, matching by "id"):
{"summary": "...", "experience": [{"id": "...", "bullets": ["...", "..."]}]}

Candidate's experience items (id, company, title, original bullets):
{EXPERIENCE_JSON}

Original summary:
{ORIGINAL_SUMMARY}
`

interface TailorResult {
  summary?: string
  experience?: Array<{ id: string; bullets: string[] }>
}

export async function tailorResume(
  masterEntities: ExtractedEntities,
  job: JobView,
  skillGap: SkillGapClassification,
  userId: string
): Promise<ExtractedEntities> {
  logger.info(`Tailoring resume for user ${userId} job ${job.id}`)

  // Only send/request what the model actually needs to rewrite — see
  // resumeEnhancer.ts's identical fix for why echoing the full resume back
  // through the model reliably truncates past maxTokens on a real resume.
  const experienceInput = masterEntities.experience.map((exp) => ({
    id: exp.id,
    company: exp.company,
    title: exp.title,
    bullets: exp.bullets,
  }))

  const prompt = TAILOR_PROMPT
    .replace('{JOB_TITLE}', job.title)
    .replace('{JOB_DESCRIPTION}', job.description)
    .replace('{EXISTING_SKILLS}', skillGap.existing.join(', ') || 'none identified')
    .replace('{SUPPORTED_SKILLS}', skillGap.supportedByResume.join(', ') || 'none identified')
    .replace('{EXPERIENCE_JSON}', JSON.stringify(experienceInput, null, 2))
    .replace('{ORIGINAL_SUMMARY}', masterEntities.summary ?? '(none provided)')

  try {
    const tailored = await generateJson<TailorResult>(prompt, {
      userId,
      feature: 'resume_tailoring',
      maxTokens: 8192,
    })

    return {
      ...masterEntities,
      summary: tailored.summary ?? masterEntities.summary,
      experience: masterEntities.experience.map((originalExp) => {
        const tailoredExp = tailored.experience?.find((e) => e.id === originalExp.id)
        // Only accept bullets that already existed on this role — reordering/
        // rewording is fine, inventing a new bullet out of thin air is not.
        const candidateBullets = tailoredExp?.bullets
        const bullets =
          candidateBullets && candidateBullets.length <= originalExp.bullets.length
            ? candidateBullets
            : originalExp.bullets
        return { ...originalExp, bullets }
      }),
    }
  } catch (err) {
    logger.error('Resume tailoring failed', { err: (err as Error).message })
    throw err
  }
}
