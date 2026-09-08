import jooble from '../../../src/services/jobs/providers/jooble'

const ORIG = process.env.JOOBLE_API_KEY

afterEach(() => {
  if (ORIG === undefined) delete process.env.JOOBLE_API_KEY
  else process.env.JOOBLE_API_KEY = ORIG
})

describe('jooble provider — no API key configured', () => {
  beforeEach(() => {
    delete process.env.JOOBLE_API_KEY
  })

  it('detect() returns null', () => {
    expect(jooble.detect({ name: 'x' })).toBeNull()
  })

  it('fetch() returns [] without making any request', async () => {
    let called = false
    const out = await jooble.fetch(
      { name: 'x' },
      { fetchJson: async () => { called = true; return {} }, fetchText: async () => '' }
    )
    expect(out).toEqual([])
    expect(called).toBe(false)
  })
})

describe('jooble provider — API key configured', () => {
  beforeEach(() => {
    process.env.JOOBLE_API_KEY = 'jk-123'
  })

  it('detect() returns the api base', () => {
    expect(jooble.detect({ name: 'x' })?.url).toBe('https://jooble.org/api')
  })

  it('POSTs keywords + India and Remote locations to the keyed endpoint', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    await jooble.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Backend Engineer', 'SRE'] } } as never,
      {
        fetchJson: async (url, opts) => { calls.push({ url, body: JSON.parse(opts!.body as string) }); return { jobs: [] } },
        fetchText: async () => '',
      }
    )
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe('https://jooble.org/api/jk-123')
    expect(calls[0].body).toMatchObject({ keywords: 'Backend Engineer, SRE', location: 'India', page: '1' })
    expect(calls[1].body).toMatchObject({ location: 'Remote' })
  })

  it('normalizes jobs, strips HTML from the snippet, falls back company→source, drops rows without a link', async () => {
    const out = await jooble.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Engineer'] } } as never,
      {
        fetchJson: async () => ({
          jobs: [
            { title: 'Engineer', link: 'https://jooble.org/desc/1', snippet: 'Do <b>stuff</b> &amp; things', company: '', source: 'naukri.com', updated: '2026-02-19T00:00:00Z' },
            { title: 'No link role', snippet: 'x' },
          ],
        }),
        fetchText: async () => '',
      }
    )
    expect(out).toHaveLength(2) // one valid job per pass (India + Remote)
    expect(out[0].url).toBe('https://jooble.org/desc/1')
    expect(out[0].description).toBe('Do stuff & things')
    expect(out[0].company).toBe('naukri.com')
    expect(typeof out[0].postedAt).toBe('number')
  })

  it('wraps a transport failure with a provider-identified error', async () => {
    await expect(
      jooble.fetch(
        { name: 'x', query: { countryCodes: ['IN'] } } as never,
        { fetchJson: async () => { throw new Error('HTTP 500') }, fetchText: async () => '' }
      )
    ).rejects.toThrow(/jooble: request failed/)
  })
})
