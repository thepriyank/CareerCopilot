import { computeExperienceFit, resolveJobYearsBand } from '../../src/services/matching/experienceFit'

describe('resolveJobYearsBand', () => {
  it('prefers the JD\'s own explicit min/max when stated', () => {
    expect(resolveJobYearsBand(8, 12, 'staff')).toEqual({ min: 8, max: 12 })
  })

  it('fills the other side from whichever explicit bound is given', () => {
    expect(resolveJobYearsBand(8, null, 'staff')).toEqual({ min: 8, max: 8 })
    expect(resolveJobYearsBand(null, 5, 'mid')).toEqual({ min: 5, max: 5 })
  })

  it('falls back to the tier-based band when no explicit years are stated', () => {
    expect(resolveJobYearsBand(null, null, 'intern')).toEqual({ min: 0, max: 0 })
    expect(resolveJobYearsBand(null, null, 'staff')).toEqual({ min: 8, max: 12 })
    expect(resolveJobYearsBand(null, null, 'director')).toEqual({ min: 15, max: 25 })
  })

  it('returns null for a missing/invalid tier with no explicit years either', () => {
    expect(resolveJobYearsBand(null, null, null)).toBeNull()
    expect(resolveJobYearsBand(null, null, 'not-a-real-tier')).toBeNull()
  })
})

describe('computeExperienceFit', () => {
  it('scores full credit when the candidate sits inside the job\'s band', () => {
    const result = computeExperienceFit(10, { min: 8, max: 12 })
    expect(result).toEqual({ fit: 1, label: 'closely-matched', gapYears: 0 })
  })

  it('treats a 1-2 year gap beyond the band as still closely matched', () => {
    expect(computeExperienceFit(6, { min: 8, max: 12 }).label).toBe('closely-matched') // 2 below min
    expect(computeExperienceFit(14, { min: 8, max: 12 }).label).toBe('closely-matched') // 2 above max
  })

  // The real reported bug: a highly experienced candidate against a junior/
  // intern role must score very low on this axis, not neutral.
  it('scores a large overqualification gap near the floor', () => {
    const result = computeExperienceFit(10, { min: 0, max: 2 })
    expect(result.label).toBe('overqualified')
    expect(result.fit).toBeLessThan(0.2)
    expect(result.gapYears).toBeGreaterThan(0)
  })

  it('is symmetric — a large underqualification gap scores just as low', () => {
    const result = computeExperienceFit(1, { min: 8, max: 12 })
    expect(result.label).toBe('underqualified')
    expect(result.fit).toBeLessThan(0.2)
  })

  it('never returns a literal zero, even for an extreme gap', () => {
    const result = computeExperienceFit(20, { min: 0, max: 0 })
    expect(result.fit).toBeGreaterThan(0)
  })

  it('treats a missing candidate years or job band as neutral, not a penalty', () => {
    expect(computeExperienceFit(null, { min: 8, max: 12 })).toEqual({ fit: 0.85, label: 'unknown', gapYears: 0 })
    expect(computeExperienceFit(10, null)).toEqual({ fit: 0.85, label: 'unknown', gapYears: 0 })
  })
})
