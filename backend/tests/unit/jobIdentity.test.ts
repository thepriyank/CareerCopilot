import { canonicalizeUrl, hashJobUrl } from '../../src/services/jobs/jobIdentity'

describe('canonicalizeUrl', () => {
  it('lowercases the protocol and host but leaves the path/query as-is', () => {
    expect(canonicalizeUrl('HTTPS://Example.COM/Jobs/123?ref=abc')).toBe('https://example.com/Jobs/123?ref=abc')
  })

  it('strips a trailing slash from the path', () => {
    expect(canonicalizeUrl('https://example.com/jobs/123/')).toBe('https://example.com/jobs/123')
  })

  it('does not strip the root path slash', () => {
    expect(canonicalizeUrl('https://example.com/')).toBe('https://example.com/')
  })

  it('keeps query strings intact — different query means a different job', () => {
    const a = canonicalizeUrl('https://boards.greenhouse.io/acme/jobs?gh_jid=1')
    const b = canonicalizeUrl('https://boards.greenhouse.io/acme/jobs?gh_jid=2')
    expect(a).not.toBe(b)
  })

  it('falls back to the trimmed original for an unparseable string rather than throwing', () => {
    expect(canonicalizeUrl('  not a url at all  ')).toBe('not a url at all')
  })
})

describe('hashJobUrl', () => {
  it('is deterministic for the same URL', () => {
    expect(hashJobUrl('https://example.com/jobs/1')).toBe(hashJobUrl('https://example.com/jobs/1'))
  })

  it('is the same hash for a URL that only differs by case/trailing slash', () => {
    expect(hashJobUrl('https://Example.com/jobs/1/')).toBe(hashJobUrl('https://example.com/jobs/1'))
  })

  it('differs for two different real URLs', () => {
    expect(hashJobUrl('https://example.com/jobs/1')).not.toBe(hashJobUrl('https://example.com/jobs/2'))
  })

  it('returns a distinct, non-colliding value every time for a null/missing URL', () => {
    const a = hashJobUrl(null)
    const b = hashJobUrl(undefined)
    const c = hashJobUrl('')
    expect(a).not.toBe(b)
    expect(b).not.toBe(c)
    expect(a).not.toBe(c)
  })
})
