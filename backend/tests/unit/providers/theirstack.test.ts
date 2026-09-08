import theirstack from '../../../src/services/jobs/providers/theirstack'

const ORIGINAL_ENV = process.env.THEIRSTACK_API_KEY

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.THEIRSTACK_API_KEY
  else process.env.THEIRSTACK_API_KEY = ORIGINAL_ENV
})

describe('theirstack provider — no API key configured', () => {
  beforeEach(() => {
    delete process.env.THEIRSTACK_API_KEY
  })

  it('detect() returns null', () => {
    expect(theirstack.detect({ name: 'anything' })).toBeNull()
  })

  it('fetch() returns [] without making any request', async () => {
    let called = false
    const fetched = await theirstack.fetch(
      { name: 'anything' },
      { fetchJson: async () => { called = true; return {} }, fetchText: async () => '' }
    )
    expect(fetched).toEqual([])
    expect(called).toBe(false)
  })
})

describe('theirstack provider — API key configured', () => {
  beforeEach(() => {
    process.env.THEIRSTACK_API_KEY = 'test-key-123'
  })

  it('detect() returns the search URL', () => {
    expect(theirstack.detect({ name: 'anything' })?.url).toBe('https://api.theirstack.com/v1/jobs/search')
  })

  it('fetch() POSTs with a Bearer token and India as the default country filter', async () => {
    let capturedUrl: string | undefined
    let capturedOpts: any
    await theirstack.fetch(
      { name: 'anything' },
      {
        fetchJson: async (url, opts) => { capturedUrl = url; capturedOpts = opts; return { data: [] } },
        fetchText: async () => '',
      }
    )
    expect(capturedUrl).toBe('https://api.theirstack.com/v1/jobs/search')
    expect(capturedOpts.method).toBe('POST')
    expect(capturedOpts.headers.Authorization).toBe('Bearer test-key-123')
    const sentBody = JSON.parse(capturedOpts.body)
    expect(sentBody.job_country_code_or).toEqual(['IN'])
  })

  it('normalizes a { data: [...] } response and handles both string and object company shapes', async () => {
    const fetched = await theirstack.fetch(
      { name: 'anything' },
      {
        fetchJson: async () => ({
          data: [
            { title: 'Backend Engineer', url: 'https://example.com/1', company: 'Acme', location: 'Bengaluru' },
            { title: 'Frontend Engineer', url: 'https://example.com/2', company: { name: 'Beta Co' } },
          ],
        }),
        fetchText: async () => '',
      }
    )
    expect(fetched).toHaveLength(2)
    expect(fetched[0].company).toBe('Acme')
    expect(fetched[1].company).toBe('Beta Co')
  })

  it('drops rows without a usable url', async () => {
    const fetched = await theirstack.fetch(
      { name: 'anything' },
      { fetchJson: async () => ({ data: [{ title: 'No URL' }] }), fetchText: async () => '' }
    )
    expect(fetched).toEqual([])
  })

  it('wraps a transport failure with a provider-identified error rather than throwing raw', async () => {
    await expect(
      theirstack.fetch(
        { name: 'anything' },
        { fetchJson: async () => { throw new Error('HTTP 401 Unauthorized') }, fetchText: async () => '' }
      )
    ).rejects.toThrow(/theirstack: request failed/)
  })
})
