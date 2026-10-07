jest.mock('../../src/config/dataSource', () => ({ AppDataSource: { getRepository: jest.fn() } }))

import { coverLetterPlainText, safeFilenamePart } from '../../src/services/extension/artifactFiles'

describe('safeFilenamePart()', () => {
  it.each([
    ['Priya Sharma', 'Priya_Sharma'],
    ['Senior Engineer / Payments: "Core"', 'Senior_Engineer_Payments_Core'],
    ['José Ñúñez', 'Jose_Nunez'],
    ['  ..hidden..  ', 'hidden'],
    ['a\u0000b<c>d|e?f*g', 'abcdefg'],
    ['', ''],
    [null, ''],
  ])('%p → %p', (input, expected) => {
    expect(safeFilenamePart(input as string | null)).toBe(expected)
  })

  it('caps the length', () => {
    expect(safeFilenamePart('x'.repeat(200)).length).toBe(60)
  })
})

describe('coverLetterPlainText()', () => {
  it('renders the letter as paragraphs, with achievements as bullets and the candidate name last', () => {
    const text = coverLetterPlainText({
      candidate: { name: 'Priya Sharma' },
      letter: {
        role_title: 'Staff Engineer',
        greeting: 'Dear Hiring Team,',
        opening: 'I am applying for the Staff Engineer role.',
        profile_intro: 'I build payment systems.',
        achievements: [{ lead: 'Cut latency', impact: 'by 40%' }],
        closing: 'Thank you for your time.',
      },
    })
    expect(text).toBe(
      'Dear Hiring Team,\n\nI am applying for the Staff Engineer role.\n\nI build payment systems.\n\n• Cut latency — by 40%\n\nThank you for your time.\n\nPriya Sharma'
    )
  })

  it('returns empty text for a malformed payload', () => {
    expect(coverLetterPlainText({} as never)).toBe('')
  })
})
