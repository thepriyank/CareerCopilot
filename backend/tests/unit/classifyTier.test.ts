import { classifyTier } from '../../src/services/jobs/classifyTier'

describe('classifyTier', () => {
  const cases: Array<[string, ReturnType<typeof classifyTier>]> = [
    ['Software Engineer Intern', 'intern'],
    ['Junior Software Engineer', 'entry'],
    ['Software Engineer I', 'entry'],
    ['Software Engineer II', 'mid'],
    ['Senior Software Engineer', 'senior'],
    ['Staff Engineer', 'senior'],
    ['Principal Engineer', 'senior'],
    ['VP of Engineering', 'senior'],
    ['Engineering Intern Program', 'intern'],
    ['Software Engineer', 'mid'],
    ['Senior Intern Coordinator', 'senior'],
    ['Graduate Engineer', 'mid'],
    ['Graduate Engineer Program', 'intern'],
    ['A.I. Researcher', 'mid'],
    ['I.T. Specialist II', 'mid'],
  ]

  it.each(cases)('classifies "%s" as %s', (title, expected) => {
    expect(classifyTier(title)).toBe(expected)
  })

  it('defaults to mid for non-string input', () => {
    // @ts-expect-error deliberately passing a non-string to exercise the guard
    expect(classifyTier(undefined)).toBe('mid')
  })
})
