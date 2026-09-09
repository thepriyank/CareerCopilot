import { hasAvoidedRequiredTech } from '../../src/services/matching/avoidedTechFilter'

describe('hasAvoidedRequiredTech', () => {
  it('returns false when the candidate has no avoid list', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['Java'] }, [])).toBe(false)
  })

  it('returns false when the job has no required skills at all', () => {
    expect(hasAvoidedRequiredTech({}, ['Java'])).toBe(false)
    expect(hasAvoidedRequiredTech(null, ['Java'])).toBe(false)
  })

  it('excludes a job whose required skills include an avoided technology, case-insensitively', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['java', 'Spring Boot'] }, ['Java'])).toBe(true)
  })

  it('does NOT exclude a job that only lists the avoided tech as nice-to-have', () => {
    expect(
      hasAvoidedRequiredTech({ requiredSkills: ['Python'], niceToHaveSkills: ['Java'] }, ['Java'])
    ).toBe(false)
  })

  it('does not false-positive on a substring match (Java inside JavaScript)', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['JavaScript', 'React'] }, ['Java'])).toBe(false)
  })

  it('does not false-positive on a substring match (R inside React)', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['React'] }, ['R'])).toBe(false)
  })

  it('deliberately broad: an avoided "React" still matches "React Native"', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['React Native'] }, ['React'])).toBe(true)
  })

  it('handles regex-special characters in technology names (C++, C#, .NET)', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['C++'] }, ['C++'])).toBe(true)
    expect(hasAvoidedRequiredTech({ requiredSkills: ['C# / .NET'] }, ['.NET'])).toBe(true)
    expect(hasAvoidedRequiredTech({ requiredSkills: ['C++ Developer'] }, ['C++'])).toBe(true) // trailing space after the term
  })

  it('excludes when ANY avoided technology matches ANY required skill', () => {
    expect(
      hasAvoidedRequiredTech({ requiredSkills: ['Node.js', 'PHP'] }, ['Ruby', 'PHP'])
    ).toBe(true)
  })

  it('ignores blank entries in the avoid list', () => {
    expect(hasAvoidedRequiredTech({ requiredSkills: ['Java'] }, ['', '  '])).toBe(false)
  })
})
