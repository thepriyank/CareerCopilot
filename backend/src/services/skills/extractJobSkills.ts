/**
 * AI-based job requirements extraction — Tier A of the 2026-09-06 matching
 * redesign (see the architecture memo this followed), broadened 2026-09-21
 * to also extract seniority tier, years-of-experience range, and salary —
 * see matchScore.ts's v4 header comment for why. Mirrors
 * `services/parsing/entityExtractor.ts`'s résumé-side pattern exactly: one
 * LLM call, "extract only what's stated, never invent" guardrails, called
 * ONCE per job at ingestion (see `discoveryService.ts`), not per match.
 *
 * Runs once per `JobListing` — not once per user — because JobListing is now
 * the shared, deduped row every user who has this job points at (see
 * JobListing.ts). That's what makes "once at ingestion" actually mean once,
 * not once-per-user the way it would have on the old per-user `JobPosting`.
 *
 * 2026-09-21: everything this file extracts — seniority tier, years of
 * experience, salary — is judged by the LLM from the full JD (title +
 * description + whatever the scraper already found), in this one existing
 * call, rather than by a second regex pass over the text. A regex can only
 * pattern-match surface phrasing ("5+ years"); it can't weigh a JD's title,
 * responsibilities, and stated years together the way a human reader (or an
 * LLM) does to judge "this is really a Staff-level role" when the JD never
 * uses that word. Regex only remains as the emergency fallback below, for
 * when every LLM provider is unavailable — same tradeoff already accepted
 * for skills extraction.
 *
 * Falls back to the older regex extractor (`jdSkillGap.ts`'s
 * `extractJdSkills`, plus `classifyTier.ts` for tier) when every LLM
 * provider is unavailable, rather than leaving a listing with no skills at
 * all — a real fallback, not dead code: both are well-tested and still a
 * reasonable floor when the free-tier chain is exhausted. Years-of-
 * experience and salary have no regex fallback (too failure-prone to guess
 * at reliably) — they simply stay null, which matching already treats as
 * "unknown, don't penalize."
 */

import { generateJson } from '../ai/anthropicClient'
import { extractJdSkills } from './jdSkillGap'
import { classifyTier, SeniorityTier } from '../jobs/classifyTier'
import { logger } from '../../utils/logger'

export interface JobSkillsExtraction {
  requiredSkills: string[]
  niceToHaveSkills: string[]
  seniorityLevel: string | null
  seniorityTier: SeniorityTier
  minYearsExperience: number | null
  maxYearsExperience: number | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

interface RawJobSkills {
  requiredSkills?: string[]
  niceToHaveSkills?: string[]
  seniorityLevel?: string | null
  seniorityTier?: string | null
  minYearsExperience?: number | null
  maxYearsExperience?: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
}

const VALID_TIERS: SeniorityTier[] = [
  'intern', 'entry', 'mid', 'senior', 'staff', 'principal', 'director', 'manager',
]

function coerceTier(value: string | null | undefined, titleFallback: string): SeniorityTier {
  const normalized = value?.trim().toLowerCase()
  if (normalized && (VALID_TIERS as string[]).includes(normalized)) return normalized as SeniorityTier
  return classifyTier(titleFallback)
}

function coerceYears(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 60 ? Math.round(n) : null
}

function coerceSalary(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
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
const EXTRACTION_PROMPT = `You are analyzing a job posting to extract structured data used to match it against candidates. The job's TITLE is given separately from its DESCRIPTION below — use both together, plus anything already known about its salary, to make each judgment. Do not invent or guess anything not actually supported by the text.

JOB TITLE:
{JOB_TITLE}

ALREADY-KNOWN SALARY TEXT (may be empty — the description below may still state a figure even if this is empty; if both are empty, salary is simply not stated anywhere):
{KNOWN_SALARY}

JOB DESCRIPTION:
{JOB_DESCRIPTION}

Extract the following:

1. SKILLS — the same kind of short, named items that would appear in a résumé's "Skills" section (e.g. "React", "Kubernetes", "SQL", "Stakeholder Management", "Negotiation"). Not full sentences. Not job duties. Not eligibility requirements.
- Only extract skills explicitly stated or clearly named in the text. Do NOT invent, infer, or add anything not present (e.g. don't assume "AWS" implies "Docker").
- Each skill must be a short, atomic name (1-5 words) — a tool, technology, technique, methodology, domain competency, or well-established named professional/soft skill (e.g. "Leadership", "Time Management", "Negotiation").
- If the JD lists several skills together in one phrase or sentence (e.g. "organizational, analytical, and leadership skills", or "Python, Java, and Go"), split them into SEPARATE individual entries — never keep a compound phrase or a whole sentence as one "skill".
- Strip generic qualifier words around the actual skill — "Strong negotiation skills" → "Negotiation", "Proficient in Microsoft Office" → "Microsoft Office", "Excellent knowledge of SQL" → "SQL". Keep only the named thing itself, not "strong"/"excellent"/"proficient in"/"knowledge of"/"experience with".
- Use the JD's own wording/casing for each skill (e.g. "React.js" stays "React.js"), after stripping qualifiers as above.
- Do NOT extract: job responsibilities or duties (e.g. "manage personnel", "train staff", "drive sales"), eligibility/logistics requirements (e.g. "valid driver's license", "reliable transportation", "willingness to travel", "ability to lift 50 lbs", "background check", "authorized to work in..."), personality traits or self-descriptions that aren't a named professional skill (e.g. "self-motivated", "detail-oriented", "entrepreneurial", "independent", "team player"), or education/degree/certification requirements (not a skill for this purpose).
- "requiredSkills" = stated as required/must-have. "niceToHaveSkills" = stated as preferred/nice-to-have/a plus.
- If the JD doesn't clearly separate required vs. preferred, put everything skill-like in "requiredSkills".

2. SENIORITY — judge this HOLISTICALLY from the title, the responsibilities/scope described, and any years-of-experience mentioned together — not from the title alone. A title can understate or overstate real seniority (e.g. some companies call a Staff-scope role "Senior Engineer II"; some call a junior role "Software Engineer" with no qualifier at all) — weigh what the role actually asks for over the label.
- "seniorityLevel" = a short human-readable label reflecting your judgment (e.g. "Senior", "Staff", "Entry-level") or null only if there is truly no signal at all (title AND description both level-agnostic).
- "seniorityTier" = exactly one of: intern, entry, mid, senior, staff, principal, director, manager. Use "manager" only for people-management roles (e.g. "Engineering Manager"), not IC roles with "lead" in the title. Use "director" for Director/VP/Chief-level roles. Pick "mid" only if there is genuinely no seniority signal anywhere.

3. YEARS OF EXPERIENCE — only if the text explicitly states a number or range (e.g. "5+ years", "8-10 years of experience", "minimum 3 years").
- "minYearsExperience" / "maxYearsExperience" = integers. For "5+ years" set min=5, max=null. For "8-10 years" set min=8, max=10. For "minimum 3 years" set min=3, max=null. If no explicit number is stated anywhere, both must be null — do NOT infer a number from the seniority label alone.

4. SALARY — check both the ALREADY-KNOWN SALARY TEXT above and the DESCRIPTION for any stated compensation figure (base salary, CTC, pay range). Normalize whichever you find into plain numbers.
- "salaryMin" / "salaryMax" = integers in the stated currency's base unit (e.g. "₹12L-18L" → 1200000 / 1800000; "$120k-150k" → 120000 / 150000; a single figure like "₹15 LPA" → min=max=1500000). Understand k (thousand) and L/lakh/lac (hundred-thousand) suffixes.
- "salaryCurrency" = a 3-letter code (INR, USD, etc.) inferred from symbols/wording (₹/Rs/LPA → INR, $ → USD, £ → GBP, € → EUR), or null if you can't tell.
- If no salary figure is stated anywhere, all three must be null.

Return valid JSON with this exact structure:
{
  "requiredSkills": ["string"],
  "niceToHaveSkills": ["string"],
  "seniorityLevel": "string or null",
  "seniorityTier": "intern|entry|mid|senior|staff|principal|director|manager",
  "minYearsExperience": "integer or null",
  "maxYearsExperience": "integer or null",
  "salaryMin": "integer or null",
  "salaryMax": "integer or null",
  "salaryCurrency": "string or null"
}`

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
 * Extracts required vs. nice-to-have skills, seniority tier, years of
 * experience, and salary from a job posting via the free-tier LLM chain —
 * all in this one call (see this file's header for why these live together
 * rather than each getting their own regex pass). `title` and
 * `knownSalaryText` are optional context so the LLM can judge seniority from
 * title+description together and reconcile/normalize whatever salary text
 * the scraper already found. On total LLM failure, falls back to the regex
 * skill extractor (everything bucketed as "required") + classifyTier(title)
 * for seniority; years/salary have no regex fallback and simply stay null
 * (matching already treats null as "unknown, don't penalize").
 */
export async function extractJobSkills(
  description: string,
  options: { userId?: string; title?: string; knownSalaryText?: string | null } = {}
): Promise<JobSkillsExtraction> {
  const title = options.title ?? ''
  const truncated = description.slice(0, MAX_TEXT_LENGTH)
  const prompt = EXTRACTION_PROMPT
    .replace('{JOB_TITLE}', title || '(not given)')
    .replace('{KNOWN_SALARY}', options.knownSalaryText || '(none)')
    .replace('{JOB_DESCRIPTION}', truncated)

  try {
    const raw = await generateJson<RawJobSkills>(prompt, {
      userId: options.userId,
      feature: 'job_skill_extraction',
    })
    return {
      requiredSkills: dedupePreserveOrder(raw.requiredSkills ?? []),
      niceToHaveSkills: dedupePreserveOrder(raw.niceToHaveSkills ?? []),
      seniorityLevel: raw.seniorityLevel?.trim() || null,
      seniorityTier: coerceTier(raw.seniorityTier, title),
      minYearsExperience: coerceYears(raw.minYearsExperience),
      maxYearsExperience: coerceYears(raw.maxYearsExperience),
      salaryMin: coerceSalary(raw.salaryMin),
      salaryMax: coerceSalary(raw.salaryMax),
      salaryCurrency: raw.salaryCurrency?.trim().toUpperCase().slice(0, 3) || null,
    }
  } catch (err) {
    logger.warn('extractJobSkills: every LLM provider failed, falling back to regex extraction', {
      err: (err as Error).message,
    })
    return {
      requiredSkills: dedupePreserveOrder(extractJdSkills(description)),
      niceToHaveSkills: [],
      seniorityLevel: null,
      seniorityTier: classifyTier(title),
      minYearsExperience: null,
      maxYearsExperience: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
    }
  }
}

/** The flat list stored on `JobListing.skills` — required ∪ nice-to-have, for matching. */
export function flattenJobSkills(extraction: JobSkillsExtraction): string[] {
  return dedupePreserveOrder([...extraction.requiredSkills, ...extraction.niceToHaveSkills])
}
