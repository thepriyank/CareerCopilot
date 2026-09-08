import { normalizeTextForAts, injectPrintPageCss } from '../../src/services/documents/renderPdf'

describe('normalizeTextForAts', () => {
  it('converts smart punctuation and dashes to ATS-safe ASCII', () => {
    const html = '<p>It&#8217;s a “great” fit — really.</p>'
    // Use literal Unicode chars directly, matching what real content contains.
    const withUnicode = '<p>It’s a “great” fit — really.</p>'
    const out = normalizeTextForAts(withUnicode)
    expect(out).toContain("It's a \"great\" fit - really.")
    void html
  })

  it('converts markdown bold to <strong> without touching style/script blocks', () => {
    const out = normalizeTextForAts('<style>.x{content:"**not bold**"}</style><p>**bold text**</p>')
    expect(out).toContain('<strong>bold text</strong>')
    expect(out).toContain('"**not bold**"')
  })

  it('replaces bullet and middle-dot glyphs with a pipe separator', () => {
    const out = normalizeTextForAts('<span>Team A • Team B · Team C</span>')
    expect(out).toContain('Team A | Team B | Team C')
  })
})

describe('injectPrintPageCss', () => {
  it('injects an @page rule sized for A4 by default', () => {
    const out = injectPrintPageCss('<html><head></head><body></body></html>')
    expect(out).toContain('@page { size: A4;')
  })

  it('injects an @page rule sized for Letter when requested', () => {
    const out = injectPrintPageCss('<html><head></head><body></body></html>', 'letter')
    expect(out).toContain('@page { size: Letter;')
  })
})
