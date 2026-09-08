/**
 * Seniority-tier classifier for job titles.
 *
 * Ported from santifer/career-ops (`classify-tier.mjs`, MIT License,
 * Copyright (c) 2026 Santiago Fernández de Valderrama) — logic translated
 * to TypeScript, otherwise unchanged.
 *
 * Uses weighted keyword matching to handle conflicts (higher weight wins).
 * Default tier is 'mid' if no keywords match.
 */

export type SeniorityTier = 'intern' | 'entry' | 'mid' | 'senior'

interface Matcher {
  pattern: RegExp | { test: (t: string) => boolean }
  tier: SeniorityTier
  weight: number
}

const matchers: Matcher[] = [
  // Senior Tier (weight 4)
  { pattern: /\bchief\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bvp\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bvice\s+president\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bdirector\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bprincipal\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bstaff\b/i, tier: 'senior', weight: 4 },
  { pattern: /\blead\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bsenior\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bsr\b/i, tier: 'senior', weight: 4 },
  { pattern: /\bsr\./i, tier: 'senior', weight: 4 },
  { pattern: /\bhead\s+of\b/i, tier: 'senior', weight: 4 },
  { pattern: /\b[a-z]{2,}[\s-](iii|iv|v)\b/i, tier: 'senior', weight: 4 },

  // Mid Tier (weight 3)
  { pattern: /\bmid-level\b/i, tier: 'mid', weight: 3 },
  { pattern: /\bmid\b/i, tier: 'mid', weight: 3 },
  { pattern: /\b[a-z]{2,}[\s-](ii)\b/i, tier: 'mid', weight: 3 },
  { pattern: /\b(l4|l5)\b/i, tier: 'mid', weight: 3 },

  // Entry Tier (weight 2)
  { pattern: /\bentry-level\b/i, tier: 'entry', weight: 2 },
  { pattern: /\bentry\b/i, tier: 'entry', weight: 2 },
  { pattern: /\bassociate\b/i, tier: 'entry', weight: 2 },
  { pattern: /\bjunior\b/i, tier: 'entry', weight: 2 },
  { pattern: /\b[a-z]{2,}[\s-](i)\b/i, tier: 'entry', weight: 2 },
  { pattern: /\b(l1|l2)\b/i, tier: 'entry', weight: 2 },

  // Intern Tier (weight 1)
  { pattern: /\binternship\b/i, tier: 'intern', weight: 1 },
  { pattern: /\bintern\b/i, tier: 'intern', weight: 1 },
  { pattern: /\btrainee\b/i, tier: 'intern', weight: 1 },
  { pattern: /\bco-op\b/i, tier: 'intern', weight: 1 },
  {
    pattern: {
      test: (t: string) => /\bgraduate\b/i.test(t) && /\b(program|scheme)\b/i.test(t),
    },
    tier: 'intern',
    weight: 1,
  },
]

/**
 * Classifies a job title into exactly one seniority tier.
 *
 * Unrecognized or plain titles (e.g. "Software Engineer" with no explicit
 * level indicators) fall back to 'mid' as the default/unknown bucket.
 */
export function classifyTier(title: string): SeniorityTier {
  if (typeof title !== 'string') {
    return 'mid'
  }

  // Preprocess title to avoid false positives with common acronyms
  const cleanTitle = title
    .replace(/\bA\.I\./gi, 'AI')
    .replace(/\bA\.I\b/gi, 'AI')
    .replace(/\bA\.\s+I\b/gi, 'AI')
    .replace(/\bI\.T\./gi, 'IT')
    .replace(/\bI\.T\b/gi, 'IT')
    .replace(/\bI\.\s+T\b/gi, 'IT')
    .replace(/\bi\/o\b/gi, 'IO')

  let bestMatch: Matcher | null = null

  for (const matcher of matchers) {
    if (matcher.pattern.test(cleanTitle)) {
      if (!bestMatch || matcher.weight > bestMatch.weight) {
        bestMatch = matcher
      }
    }
  }

  return bestMatch ? bestMatch.tier : 'mid'
}

export default classifyTier
