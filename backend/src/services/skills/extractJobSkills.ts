/**
 * AI-based job-skill extraction — Tier A of the 2026-09-06 matching redesign
 * (see the architecture memo this followed). Mirrors
 * `services/parsing/entityExtractor.ts`'s résumé-side pattern exactly: one
 * LLM call, "extract only what's stated, never invent" guardrails, called
 * ONCE per job at ingestion (see `discoveryService.ts`), not per match.
 *
 * Runs once per `JobListing` — not once per user — because JobListing is now
 * the shared, deduped row every user who has this job points at (see
 * JobListing.ts). That's what makes "once at ingestion" actually mean once,
 * not once-per-user the way it would have on the old per-user `JobPosting`.
 *
 * Falls back to the older regex extractor (`jdSkillGap.ts`'s
 * `extractJdSkills`) when every LLM provider is unavailable, rather than
 * leaving a listing with no skills at all — a real fallback, not dead code:
 * `extractJdSkills` is well-tested and still a reasonable floor when the
 * free-tier chain is exhausted.
 */

import { generateJson } from '../ai/anthropicClient'
import { extractJdSkills } from './jdSkillGap'
import { logger } from '../../utils/logger'

export interface JobSkillsExtraction {
  requiredSkills: string[]
  niceToHaveSkills: string[]
  seniorityLevel: string | null
}

interface RawJobSkills {
  requiredSkills?: string[]
  niceToHaveSkills?: string[]
  seniorityLevel?: string | null
}

const MAX_TEXT_LENGTH = 20_000

// Tightened 2026-09-06 after live testing surfaced noisy output: full
// responsibility sentences ("Manage personnel activities of staff (i.e.
// hire, train, appraise...)"), logistics/eligibility items ("reliable
// transportation", "valid driver's license"), and un-split compound phrases
// ("Excellent organizational, analytical, time management and leadership
// skills" kept as one string) were all coming back as "skills". These match
// nothing on a résumé's skills list and just inflate missingSkills with
// noise, so the prompt now defines "skill" narrowly — the same genre of
// short, named item a résumé's own Skills section would list — with
// explicit exclusions and a compound-splitting instruction.
const EXTRACTION_PROMPT = `You are analyzing a job description to extract its SKILLS — the same kind of short, named items that would appear in a résumé's "Skills" section (e.g. "React", "Kubernetes", "SQL", "Stakeholder Management", "Negotiation"). Not full sentences. Not job duties. Not eligibility requirements.

CRITICAL RULES:
- Only extract skills explicitly stated or clearly named in the text below. Do NOT invent, infer, or add anything not present (e.g. don't assume "AWS" implies "Docker").
- Each skill must be a short, atomic name (1-5 words) — a tool, technology, technique, methodology, domain competency, or well-established named professional/soft skill (e.g. "Leadership", "Time Management", "Negotiation").
- If the JD lists several skills together in one phrase or sentence (e.g. "organizational, analytical, and leadership skills", or "Python, Java, and Go"), split them into SEPARATE individual entries — never keep a compound phrase or a whole sentence as one "skill".
- Strip generic qualifier words around the actual skill — "Strong negotiation skills" → "Negotiation", "Proficient in Microsoft Office" → "Microsoft Office", "Excellent knowledge of SQL" → "SQL". Keep only the named thing itself, not "strong"/"excellent"/"proficient in"/"knowledge of"/"experience with".
- Use the JD's own wording/casing for each skill (e.g. "React.js" stays "React.js"), after stripping qualifiers as above.
- Do NOT extract: job responsibilities or duties (e.g. "manage personnel", "train staff", "drive sales"), eligibility/logistics requirements (e.g. "valid driver's license", "reliable transportation", "willingness to travel", "ability to lift 50 lbs", "background check", "authorized to work in..."), personality traits or self-descriptions that aren't a named professional skill (e.g. "self-motivated", "detail-oriented", "entrepreneurial", "independent", "team player"), or education/degree/certification requirements (not a skill for this purpose).
- "requiredSkills" = stated as required/must-have. "niceToHaveSkills" = stated as preferred/nice-to-have/a plus.
- If the JD doesn't clearly separate required vs. preferred, put everything skill-like in "requiredSkills".
- "seniorityLevel" = a short label the JD itself implies (e.g. "Senior", "Lead", "Entry-level") or null if it doesn't say.

Return valid JSON with this exact structure:
{
  "requiredSkills": ["string"],
  "niceToHaveSkills": ["string"],
  "seniorityLevel": "string or null"
}

JOB DESCRIPTION:
{JOB_DESCRIPTION}`

function dedupePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const trimmed = item.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/**
 * Extracts required vs. nice-to-have skills from a job description via the
 * free-tier LLM chain. On total LLM failure, falls back to the regex
 * extractor with everything bucketed as "required" (the regex extractor
 * doesn't distinguish required/preferred) rather than returning nothing.
 */
export async function extractJobSkills(
  description: string,
  options: { userId?: string } = {}
): Promise<JobSkillsExtraction> {
  const truncated = description.slice(0, MAX_TEXT_LENGTH)
  const prompt = EXTRACTION_PROMPT.replace('{JOB_DESCRIPTION}', truncated)

  try {
    const raw = await generateJson<RawJobSkills>(prompt, {
      userId: options.userId,
      feature: 'job_skill_extraction',
    })
    return {
      requiredSkills: dedupePreserveOrder(raw.requiredSkills ?? []),
      niceToHaveSkills: dedupePreserveOrder(raw.niceToHaveSkills ?? []),
      seniorityLevel: raw.seniorityLevel?.trim() || null,
    }
  } catch (err) {
    logger.warn('extractJobSkills: every LLM provider failed, falling back to regex extraction', {
      err: (err as Error).message,
    })
    return {
      requiredSkills: dedupePreserveOrder(extractJdSkills(description)),
      niceToHaveSkills: [],
      seniorityLevel: null,
    }
  }
}

/** The flat list stored on `JobListing.skills` — required ∪ nice-to-have, for matching. */
export function flattenJobSkills(extraction: JobSkillsExtraction): string[] {
  return dedupePreserveOrder([...extraction.requiredSkills, ...extraction.niceToHaveSkills])
}
