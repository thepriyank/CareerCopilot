/**
 * Tier-B swap point (see the 2026-09-06 matching-redesign memo this session
 * produced, and the user's explicit instruction to keep this path named and
 * tracked rather than removed). Today this is exactly the TF-cosine
 * `cosineSimilarity()` from lexicalSimilarity.ts — a real, working signal on
 * its own, not a placeholder. When embedding-based semantic matching (Tier
 * B — pgvector + an embedding provider, deferred post-MVP per the memo's
 * cost comparison) is built, only this function's internals change to call
 * an embedding provider + vector cosine distance; matchScore.ts and its
 * WEIGHTS.lexical weighting never need to change, and this name keeps the
 * intent ("how semantically similar is this resume to this JD") separate
 * from the specific technique currently implementing it.
 */

import { cosineSimilarity } from './lexicalSimilarity'

export function computeSemanticSimilarity(resumeText: string, jobDescription: string): number {
  return cosineSimilarity(resumeText, jobDescription)
}
