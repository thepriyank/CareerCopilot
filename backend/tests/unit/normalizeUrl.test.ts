import { normalizeApplicationUrl } from '../../src/services/extension/normalizeUrl'

describe('normalizeApplicationUrl', () => {
  it('lowercases scheme and host, and strips a trailing slash', () => {
    expect(normalizeApplicationUrl('HTTPS://Boards.Greenhouse.IO/acme/jobs/123/'))
      .toBe('https://boards.greenhouse.io/acme/jobs/123')
  })

  it('strips known tracking params but keeps everything else', () => {
    const url = 'https://jobs.lever.co/acme/123?utm_source=li&utm_campaign=x&gh_src=abc&ref=homepage&lever-source=Linkedin'
    expect(normalizeApplicationUrl(url)).toBe('https://jobs.lever.co/acme/123?lever-source=Linkedin')
  })

  it('strips the fragment', () => {
    expect(normalizeApplicationUrl('https://example.com/apply#section-2')).toBe('https://example.com/apply')
  })

  it('two links that differ only in tracking junk normalize to the same value', () => {
    const a = 'https://boards.greenhouse.io/acme/jobs/123?gh_src=abc123&utm_medium=email'
    const b = 'https://boards.greenhouse.io/acme/jobs/123/?utm_source=newsletter'
    expect(normalizeApplicationUrl(a)).toBe(normalizeApplicationUrl(b))
  })

  it('falls back to a lowercased trim for an unparseable URL rather than throwing', () => {
    expect(normalizeApplicationUrl('  Not A Real URL  ')).toBe('not a real url')
  })
})
