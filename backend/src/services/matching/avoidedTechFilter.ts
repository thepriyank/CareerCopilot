/**
 * Hard exclusion (2026-09-09) — "sometimes people have something in their
 * older experience but don't want to work on them... this will help filter
 * out those jobs which has those avoided technologies as mandatory."
 *
 * Deliberately checks only `normalizedFields.requiredSkills`, not
 * `JobListing.skills` (the flattened required+nice-to-have union used for
 * match scoring) — a job that merely lists an avoided technology as a
 * nice-to-have shouldn't be hidden outright, only one that requires it. See
 * services/skills/extractJobSkills.ts's `JobSkillsExtraction` for the
 * required/nice-to-have split this reads.
 *
 * This is an exclusion, not a scoring signal: a match this rejects is never
 * surfaced at all (see surfaceJobs.ts), not merely scored lower — matching
 * the product ask exactly ("filter out", not "penalize").
 */

function requiredSkillsOf(normalizedFields: Record<string, unknown> | null | undefined): string[] {
  const requiredSkills = (normalizedFields as { requiredSkills?: unknown } | null | undefined)?.requiredSkills
  return Array.isArray(requiredSkills) ? requiredSkills.filter((s): s is string => typeof s === 'string') : []
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Case-insensitive whole-word match, not a plain substring check — a naive
 * `.includes()` would match an avoided "Java" inside a required
 * "JavaScript" (and similarly "R" inside "React"), which would wrongly
 * exclude every JavaScript job for someone who only wanted to avoid Java.
 * Word boundaries still allow the intentionally-broad case an avoided
 * "React" matching a required "React Native" — "React" appears as its own
 * word there — without the false-positive substring risk.
 *
 * Uses lookaround, not `\b`: `\b` requires one side of the boundary to
 * already be a word character, which never holds for a term ending in a
 * non-word character (e.g. "C++", "C#") — `\bC\+\+\b` can never match
 * "C++" followed by a space or end-of-string, since neither side of that
 * trailing boundary is a `\w`. `(?<!\w)...(?!\w)` only asserts that the
 * character immediately outside the match isn't a word character, which
 * holds correctly regardless of what the match's own edges look like.
 */
function isWholeWordMatch(haystack: string, needle: string): boolean {
  return new RegExp(`(?<!\\w)${escapeRegex(needle)}(?!\\w)`, 'i').test(haystack)
}

/**
 * True when the job requires (not merely prefers) at least one technology
 * the candidate has listed as avoided.
 */
export function hasAvoidedRequiredTech(
  normalizedFields: Record<string, unknown> | null | undefined,
  avoidTechnologies: string[]
): boolean {
  if (!avoidTechnologies || avoidTechnologies.length === 0) return false
  const required = requiredSkillsOf(normalizedFields)
  if (required.length === 0) return false

  const avoided = avoidTechnologies.map((t) => t.trim()).filter(Boolean)
  return avoided.some((avoidedTech) => required.some((req) => isWholeWordMatch(req, avoidedTech)))
}
