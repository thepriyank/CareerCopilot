import adzuna from '../../../src/services/jobs/providers/adzuna'

const ORIG_ID = process.env.ADZUNA_APP_ID
const ORIG_KEY = process.env.ADZUNA_APP_KEY

afterEach(() => {
  if (ORIG_ID === undefined) delete process.env.ADZUNA_APP_ID
  else process.env.ADZUNA_APP_ID = ORIG_ID
  if (ORIG_KEY === undefined) delete process.env.ADZUNA_APP_KEY
  else process.env.ADZUNA_APP_KEY = ORIG_KEY
})

describe('adzuna provider — credentials not configured', () => {
  beforeEach(() => {
    delete process.env.ADZUNA_APP_ID
    delete process.env.ADZUNA_APP_KEY
  })

  it('detect() returns null when either credential is missing', () => {
    expect(adzuna.detect({ name: 'x' })).toBeNull()
    process.env.ADZUNA_APP_ID = 'id-only'
    expect(adzuna.detect({ name: 'x' })).toBeNull()
  })

  it('fetch() returns [] without making any request', async () => {
    let called = false
    const out = await adzuna.fetch(
      { name: 'x' },
      { fetchJson: async () => { called = true; return {} }, fetchText: async () => '' }
    )
    expect(out).toEqual([])
    expect(called).toBe(false)
  })
})

describe('adzuna provider — credentials configured', () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = 'app-id'
    process.env.ADZUNA_APP_KEY = 'app-key'
  })

  it('detect() returns the api base', () => {
    expect(adzuna.detect({ name: 'x' })?.url).toBe('https://api.adzuna.com/v1/api/jobs')
  })

  it('queries the India board with credentials and one request per title plus a remote pass', async () => {
    const urls: string[] = []
    await adzuna.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Backend Engineer', 'Platform Engineer'] } } as never,
      { fetchJson: async (url) => { urls.push(url); return { results: [] } }, fetchText: async () => '' }
    )
    expect(urls).toHaveLength(3) // 2 titles + 1 remote
    expect(urls.every((u) => u.startsWith('https://api.adzuna.com/v1/api/jobs/in/search/1?'))).toBe(true)
    expect(urls[0]).toContain('app_id=app-id')
    expect(urls[0]).toContain('app_key=app-key')
    expect(urls[0]).toContain('what=Backend+Engineer')
    expect(urls[2]).toContain('where=remote')
  })

  it('falls back to a single country query when no titles are given', async () => {
    const urls: string[] = []
    await adzuna.fetch(
      { name: 'x', query: { countryCodes: ['IN'] } } as never,
      { fetchJson: async (url) => { urls.push(url); return { results: [] } }, fetchText: async () => '' }
    )
    expect(urls).toHaveLength(2) // country + remote
  })

  it('normalizes results, strips HTML, maps salary currency by country, drops rows with no redirect_url', async () => {
    const out = await adzuna.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Engineer'] } } as never,
      {
        fetchJson: async () => ({
          results: [
            {
              title: '<strong>Senior</strong> Engineer',
              redirect_url: 'https://www.adzuna.in/land/ad/123',
              company: { display_name: 'Acme &amp; Co' },
              location: { display_name: 'Bengaluru' },
              description: 'Build <b>things</b>.',
              created: '2026-02-20T10:00:00Z',
              salary_min: 2000000,
              salary_max: 3500000,
            },
            { title: 'No URL role' },
          ],
        }),
        fetchText: async () => '',
      }
    )
    expect(out).toHaveLength(2) // one per request (title + remote); remote pass returns same shape here
    const j = out[0]
    expect(j.title).toBe('Senior Engineer')
    expect(j.company).toBe('Acme & Co')
    expect(j.description).toBe('Build things.')
    expect(j.url).toBe('https://www.adzuna.in/land/ad/123')
    expect(j.salary).toEqual({ min: 2000000, max: 3500000, currency: 'INR' })
    expect(typeof j.postedAt).toBe('number')
  })

  it('wraps a transport failure with a provider-identified error', async () => {
    await expect(
      adzuna.fetch(
        { name: 'x', query: { countryCodes: ['IN'] } } as never,
        { fetchJson: async () => { throw new Error('HTTP 429 Too Many Requests') }, fetchText: async () => '' }
      )
    ).rejects.toThrow(/adzuna: request failed/)
  })
})
