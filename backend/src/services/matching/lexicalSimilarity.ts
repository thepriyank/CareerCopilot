/**
 * Term-frequency cosine similarity — a deterministic, zero-dependency
 * lexical similarity measure. This is the v1 stand-in for a dense semantic
 * embedding model (see matchScore.ts's doc comment for why); it's a
 * legitimate, well-understood technique on its own, just not a neural one.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'you', 'your', 'our', 'we', 'they', 'it', 'is', 'was', 'were', 'are', 'be', 'been',
  'have', 'had', 'has', 'do', 'did', 'does', 'this', 'that', 'these', 'those',
  'will', 'would', 'should', 'can', 'could', 'as', 'by', 'from', 'about',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1)
  }
  return tf
}

function dotProduct(a: Map<string, number>, b: Map<string, number>): number {
  let sum = 0
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  for (const [term, count] of smaller) {
    const other = larger.get(term)
    if (other) sum += count * other
  }
  return sum
}

function magnitude(v: Map<string, number>): number {
  let sum = 0
  for (const count of v.values()) sum += count * count
  return Math.sqrt(sum)
}

/** Cosine similarity between the term-frequency vectors of two texts, in [0, 1]. */
export function cosineSimilarity(textA: string, textB: string): number {
  const tfA = termFrequency(tokenize(textA))
  const tfB = termFrequency(tokenize(textB))
  if (tfA.size === 0 || tfB.size === 0) return 0

  const magA = magnitude(tfA)
  const magB = magnitude(tfB)
  if (magA === 0 || magB === 0) return 0

  return dotProduct(tfA, tfB) / (magA * magB)
}
