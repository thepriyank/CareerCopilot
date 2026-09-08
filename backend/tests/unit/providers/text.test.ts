import { stripHtml, htmlToText } from '../../../src/services/jobs/providers/text'

describe('stripHtml', () => {
  it('strips tags and decodes entities into a single-line string', () => {
    expect(stripHtml('Build <b>things</b> &amp; ship them.')).toBe('Build things & ship them.')
  })

  it('returns an empty string for nullish input', () => {
    expect(stripHtml(undefined)).toBe('')
    expect(stripHtml(null)).toBe('')
  })
})

describe('htmlToText', () => {
  it('keeps paragraph boundaries as newlines instead of collapsing to one line', () => {
    const html = '<p>First paragraph.</p><p>Second paragraph.</p>'
    const text = htmlToText(html)
    expect(text.split('\n')).toEqual(['First paragraph.', 'Second paragraph.'])
  })

  it('prefixes <li> items with "- " on their own line', () => {
    const html = '<ul><li>Python</li><li>Kubernetes</li></ul>'
    const text = htmlToText(html)
    // A blank line between adjacent <li>s (from </li> then <li> each adding a
    // newline) is cosmetic only — jdSkillGap.ts's line scanner skips blanks.
    const nonBlankLines = text.split('\n').filter(Boolean)
    expect(nonBlankLines).toEqual(['- Python', '- Kubernetes'])
  })

  it('merges a bullet marker stranded on its own line by a nested block element', () => {
    // Common copy-paste shape: <li>\n  <p>text</p>\n</li> — the newline
    // between <li> and <p> would otherwise split "-" from its own text.
    const html = '<li>\n  <p>3+ years of experience</p>\n</li>'
    const text = htmlToText(html)
    expect(text).toBe('- 3+ years of experience')
  })

  it('returns an empty string for nullish input', () => {
    expect(htmlToText(undefined)).toBe('')
    expect(htmlToText(null)).toBe('')
  })
})
