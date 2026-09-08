/**
 * Zero-LLM JD skill-gap classifier.
 *
 * Ported from santifer/career-ops (`jd-skill-gap.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama) — logic translated to
 * TypeScript and adapted to operate on in-memory strings (a JD's description
 * and a resume's flattened text) instead of `jds/*.md` / `cv.md` files.
 *
 * Extracts an explicit skill/requirement list from a job description (regex-
 * based, no LLM call), then classifies each one against resume text into
 * three buckets so a resume can be tailored honestly instead of guessed at:
 *
 *   existing            — already a named skill in the resume's Skills list
 *   supportedByResume   — not a named skill, but appears in prose elsewhere
 *   gap                 — the JD requires it, the resume has no trace of it
 *
 * Nothing is ever auto-added — this only classifies and reports.
 *
 * Design note (carried forward from the source file): the three-way
 * classification is inspired by the skill-verification pattern in
 * srbhr/Resume-Matcher (Apache-2.0) — specifically their four-way
 * verify_skill_target_plan() split. This is an independent reimplementation,
 * not a code port: different language, zero LLM calls, and folded down to
 * three buckets because this service never auto-adds a claim to a resume
 * either way.
 */

// ── JD skill extraction (regex, no LLM) ─────────────────────────────

const REQUIREMENT_HEADER_RE =
  /^#{0,4}\s*(key\s+)?(required|requirements|qualifications|must[- ]have|preferred|nice[- ]to[- ]have|responsibilit(?:y|ies)|(?:technical|required|preferred|core)\s+skills)s?\b.*$/im

const BULLET_LINE_RE = /^\s*[-*•]\s*(.+)$/

// Some sources (JSearch/Google-for-Jobs' plain-text extraction, and most
// JDs a user copy-pastes from a webpage) lose real line breaks: a section
// heading like "Key Responsibilities" ends up glued to the end of the
// previous sentence, and/or its own first bullet glued onto its own line
// ("Key Responsibilities - Lead the team..."), with every later bullet
// genuinely on its own line. Neither REQUIREMENT_HEADER_RE (line-anchored)
// nor BULLET_LINE_RE (line-anchored) can see a heading or bullet that isn't
// at the start of its own line — so the whole section silently vanishes.
// Recover it by inserting a line break in front of a known section heading
// wherever it appears (Title Case only, to avoid splitting a casual lowercase
// mention like "...strong communication skills..." mid-sentence), and before
// any " - Capitalized" run that looks like an inline bullet separator (a
// literal " - " immediately followed by an uppercase letter — distinct from a
// bullet already at a line start, which starts with "\n-" not " -", and rare
// enough in normal prose that an occasional false split is harmless: the
// extraction loop just skips a non-bullet line either way).
// (A heading already at a line start just gets a harmless blank line inserted
// before it — blank lines are skipped by the extraction loop regardless.)
const INLINE_HEADING_RE =
  /\b(Key Responsibilities|Responsibilities|Requirements|Qualifications|Technical Skills|Required Skills|Preferred Skills|Preferred Qualifications|Core Responsibilities)\b/g
const INLINE_BULLET_RE = / [-–] (?=[A-Z])/g

function recoverFlattenedStructure(text: string): string {
  return text.replace(INLINE_HEADING_RE, '\n$1').replace(INLINE_BULLET_RE, '\n- ')
}

// Trailing boundary: \b fails at symbol edges (\bC\+\+\b needs a word char
// AFTER the +), so C++/C#/F# would never match standalone without the
// (?!\w) lookahead. Because the char class here is greedy and contains ".",
// the last token char is additionally pinned to a word char / # / + so a
// sentence-ending period is never swallowed into the token.
const SKILL_TOKEN_RE = /\b([A-Z][A-Za-z0-9+.#]{0,29}[A-Za-z0-9+#](?:\.[a-z]{2,4})?)(?!\w)/g

// Stops generic capitalized nouns/adjectives from JD bullets (e.g. "Bachelor's
// degree required", "3+ years of experience") from being misreported as
// missing "skills".
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'this', 'that', 'these', 'those',
  'must', 'able', 'ability', 'strong', 'excellent', 'proven', 'a', 'an', 'or', 'in', 'of', 'to', 'as', 'is', 'are',
  'bachelor', 'bachelors', 'master', 'masters', 'degree', 'diploma', 'certification', 'certificate',
  'experience', 'years', 'year', 'senior', 'junior', 'entry', 'level', 'minimum', 'preferred', 'required',
  'candidates', 'candidate', 'applicants', 'applicant', 'ideal', 'successful',
  'knowledge', 'understanding', 'familiarity', 'exposure', 'background',
  'skills', 'skill', 'communication', 'team', 'teams', 'work', 'working',
])

/** Extract candidate skill tokens from a JD's requirement-style sections. */
export function extractJdSkills(jdText: string): string[] {
  const lines = recoverFlattenedStructure(jdText).split('\n')
  const skills = new Set<string>()
  let inRequirementsBlock = false
  // Real job descriptions are rarely markdown — after HTML stripping, section
  // headings are just bare text lines with no leading "#". Without a heading
  // marker to detect, the block must instead close itself once the bulleted
  // list it opened for has ended (first non-bullet line seen *after* at least
  // one bullet was captured), or it keeps scanning bullets from every later
  // section (e.g. a "Compensation by Zone" list) for the rest of the document.
  let sawBulletSinceHeader = false

  for (const line of lines) {
    if (REQUIREMENT_HEADER_RE.test(line)) {
      inRequirementsBlock = true
      sawBulletSinceHeader = false
      continue
    }
    if (inRequirementsBlock && line.trim() === '') continue

    const bulletMatch = BULLET_LINE_RE.exec(line)

    if (inRequirementsBlock && !bulletMatch) {
      const isMarkdownHeading = /^#{1,4}\s/.test(line)
      if (isMarkdownHeading || sawBulletSinceHeader) {
        inRequirementsBlock = false
      }
      continue
    }

    if (inRequirementsBlock && bulletMatch) {
      sawBulletSinceHeader = true
      const bulletText = bulletMatch[1]
      let m: RegExpExecArray | null
      SKILL_TOKEN_RE.lastIndex = 0
      while ((m = SKILL_TOKEN_RE.exec(bulletText)) !== null) {
        const token = m[1].trim()
        if (!STOPWORDS.has(token.toLowerCase()) && token.length > 1) {
          skills.add(token)
        }
      }
    }
  }
  return [...skills]
}

// ── Word-boundary text matching ─────────────────────────────────────

/** Word-boundary, case-insensitive check for whether a skill token appears in text. */
export function skillMentionedInText(skill: string, text: string): boolean {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\w])${escaped}(?![\\w])`, 'i')
  return re.test(text)
}

// ── Skills-section split ─────────────────────────────────────────────

const SKILLS_HEADING_RE = /^#{1,4}\s*Skills\s*$/i
const ANY_HEADING_RE = /^#{1,4}\s/

/**
 * Split resume text into its named "Skills" section (if any, markdown-style)
 * and the remaining prose.
 */
function splitSkillsSection(resumeText: string): { namedSkillsText: string; proseText: string } {
  const lines = resumeText.split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (SKILLS_HEADING_RE.test(lines[i])) {
      start = i + 1
      break
    }
  }
  if (start === -1) {
    return { namedSkillsText: '', proseText: resumeText }
  }

  let end = lines.length
  for (let i = start; i < lines.length; i++) {
    if (ANY_HEADING_RE.test(lines[i])) {
      end = i
      break
    }
  }

  const namedSkillsText = lines.slice(start, end).join('\n')
  const proseText = lines.slice(0, start - 1).concat(lines.slice(end)).join('\n')
  return { namedSkillsText, proseText }
}

export interface SkillGapClassification {
  existing: string[]
  supportedByResume: string[]
  gap: string[]
}

/**
 * Classify each JD skill against resume text into existing /
 * supportedByResume / gap. `resumeText` may optionally contain a markdown
 * "# Skills" / "## Skills" heading — if present, only tokens named under it
 * count as "existing"; everything else is checked against the rest of the
 * text and counts as "supportedByResume" at best. Without a Skills heading,
 * every mention is treated as prose support.
 */
export function classifySkillGaps(jdSkills: string[], resumeText: string): SkillGapClassification {
  const { namedSkillsText, proseText } = splitSkillsSection(resumeText)

  const existing: string[] = []
  const supportedByResume: string[] = []
  const gap: string[] = []

  for (const skill of jdSkills) {
    if (skillMentionedInText(skill, namedSkillsText)) {
      existing.push(skill)
    } else if (skillMentionedInText(skill, proseText)) {
      supportedByResume.push(skill)
    } else {
      gap.push(skill)
    }
  }

  return { existing, supportedByResume, gap }
}
