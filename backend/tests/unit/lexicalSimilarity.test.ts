import { tokenize, cosineSimilarity } from '../../src/services/matching/lexicalSimilarity'

describe('tokenize', () => {
  it('lowercases, strips punctuation, and drops stopwords', () => {
    expect(tokenize('Backend Engineer with Python & Kubernetes!')).toEqual([
      'backend', 'engineer', 'python', 'kubernetes',
    ])
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical text', () => {
    const text = 'Senior backend engineer with Python and Kubernetes experience'
    expect(cosineSimilarity(text, text)).toBeCloseTo(1, 5)
  })

  it('returns a high score for texts sharing most of their vocabulary', () => {
    const a = 'Senior backend engineer with Python and Kubernetes experience building APIs'
    const b = 'Backend engineer skilled in Python and Kubernetes, building scalable APIs'
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.5)
  })

  it('returns a low score for unrelated texts', () => {
    const a = 'Senior backend engineer with Python and Kubernetes experience'
    const b = 'Watercolor painting workshop for beginners this weekend'
    expect(cosineSimilarity(a, b)).toBeLessThan(0.1)
  })

  it('returns 0 when either text has no meaningful tokens', () => {
    expect(cosineSimilarity('', 'Backend engineer')).toBe(0)
    expect(cosineSimilarity('the and of', 'Backend engineer')).toBe(0)
  })
})
