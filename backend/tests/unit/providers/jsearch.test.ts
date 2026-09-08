import jsearch, { normalizeJSearchResponse } from '../../../src/services/jobs/providers/jsearch'
import { resetBench } from '../../../src/services/jobs/providers/jobCredentialChain'

const ORIG_RAPID = process.env.JSEARCH_RAPID_API_KEY
const ORIG_LEGACY = process.env.JSEARCH_API_KEY
const ORIG_NINJA = process.env.JSEARCH_OPEN_WEB_NINJA_API_KEY

function clearKeys() {
  delete process.env.JSEARCH_RAPID_API_KEY
  delete process.env.JSEARCH_RAPIDAPI_KEY
  delete process.env.JSEARCH_API_KEY
  delete process.env.JSEARCH_OPEN_WEB_NINJA_API_KEY
  delete process.env.JSEARCH_OPENWEBNINJA_KEY
}

afterEach(() => {
  clearKeys()
  if (ORIG_RAPID !== undefined) process.env.JSEARCH_RAPID_API_KEY = ORIG_RAPID
  if (ORIG_LEGACY !== undefined) process.env.JSEARCH_API_KEY = ORIG_LEGACY
  if (ORIG_NINJA !== undefined) process.env.JSEARCH_OPEN_WEB_NINJA_API_KEY = ORIG_NINJA
  resetBench()
})

describe('jsearch provider — no credentials configured', () => {
  beforeEach(clearKeys)

  it('detect() returns null without any key', () => {
    expect(jsearch.detect({ name: 'x' })).toBeNull()
  })

  it('fetch() returns [] without making any request', async () => {
    let called = false
    const out = await jsearch.fetch(
      { name: 'x' },
      { fetchJson: async () => { called = true; return {} }, fetchText: async () => '' }
    )
    expect(out).toEqual([])
    expect(called).toBe(false)
  })
})

describe('jsearch provider — single RapidAPI credential (legacy JSEARCH_API_KEY)', () => {
  beforeEach(() => {
    clearKeys()
    process.env.JSEARCH_API_KEY = 'legacy-rapid-key'
  })

  it('detect() returns the RapidAPI endpoint', () => {
    expect(jsearch.detect({ name: 'x' })?.url).toBe('https://jsearch.p.rapidapi.com/search-v2')
  })

  it('queries RapidAPI with the legacy key, defaulting to "engineering manager" when no titles given', async () => {
    const calls: { url: string; headers?: Record<string, string> }[] = []
    await jsearch.fetch(
      { name: 'x', query: { countryCodes: ['IN'] } } as never,
      {
        fetchJson: async (url, opts) => { calls.push({ url, headers: opts?.headers }); return { data: [] } },
        fetchText: async () => '',
      }
    )
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('jsearch.p.rapidapi.com/search-v2')
    expect(calls[0].url).toContain('query=engineering+manager')
    expect(calls[0].headers).toMatchObject({ 'X-RapidAPI-Key': 'legacy-rapid-key', 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' })
  })

  it('issues one request per title, capped at 3', async () => {
    const urls: string[] = []
    await jsearch.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['A', 'B', 'C', 'D'] } } as never,
      { fetchJson: async (url) => { urls.push(url); return { data: [] } }, fetchText: async () => '' }
    )
    expect(urls).toHaveLength(3) // capped at MAX_TITLE_QUERIES, one fetch attempt per term
  })
})

describe('jsearch provider — dual credentials with fallback rotation', () => {
  beforeEach(() => {
    clearKeys()
    process.env.JSEARCH_RAPID_API_KEY = 'rapid-key'
    process.env.JSEARCH_OPEN_WEB_NINJA_API_KEY = 'ninja-key'
  })

  it('uses only the first (RapidAPI) credential when it succeeds — never calls the second for the same term', async () => {
    const calls: string[] = []
    await jsearch.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Engineer'] } } as never,
      { fetchJson: async (url) => { calls.push(url); return { data: [] } }, fetchText: async () => '' }
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('jsearch.p.rapidapi.com')
  })

  it('falls through to OpenWeb Ninja once the RapidAPI credential fails, and stays on it for later terms', async () => {
    const calls: string[] = []
    let rapidAttempts = 0
    await jsearch.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Engineer', 'Manager'] } } as never,
      {
        fetchJson: async (url) => {
          calls.push(url)
          if (url.includes('rapidapi')) {
            rapidAttempts++
            throw Object.assign(new Error('exceeded the MONTHLY quota'), { status: 429 })
          }
          return { data: [] }
        },
        fetchText: async () => '',
      }
    )
    // First term: tries RapidAPI (fails, benched), falls through to OpenWeb Ninja (succeeds).
    // Second term: RapidAPI is now benched for the month — goes straight to OpenWeb Ninja.
    expect(rapidAttempts).toBe(1)
    expect(calls.filter((u) => u.includes('openwebninja'))).toHaveLength(2)
  })

  it('sends OpenWeb Ninja requests with x-api-key and no RapidAPI headers', async () => {
    let headers: Record<string, string> | undefined
    await jsearch.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Engineer'] } } as never,
      {
        fetchJson: async (url, opts) => {
          if (url.includes('rapidapi')) throw Object.assign(new Error('quota exceeded'), { status: 429 })
          headers = opts?.headers
          return { data: [] }
        },
        fetchText: async () => '',
      }
    )
    expect(headers).toEqual({ 'x-api-key': 'ninja-key' })
  })

  it('returns whatever partial results it found rather than throwing, when only some terms succeed', async () => {
    const out = await jsearch.fetch(
      { name: 'x', query: { countryCodes: ['IN'], titles: ['Good', 'Bad'] } } as never,
      {
        fetchJson: async (url) => {
          if (url.includes('Bad')) throw new Error('boom')
          return { data: [{ job_title: 'Found One', job_apply_link: 'https://x.test/1', employer_name: 'Acme' }] }
        },
        fetchText: async () => '',
      }
    )
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Found One')
  })

  it('throws only when every credential fails for every term', async () => {
    await expect(
      jsearch.fetch(
        { name: 'x', query: { countryCodes: ['IN'], titles: ['Engineer'] } } as never,
        { fetchJson: async () => { throw new Error('down') }, fetchText: async () => '' }
      )
    ).rejects.toThrow(/jsearch: every credential failed/)
  })
})

describe('normalizeJSearchResponse', () => {
  const rawJob = {
    job_title: 'Engineering Manager',
    job_apply_link: 'https://in.linkedin.com/jobs/view/engineering-manager-123',
    employer_name: 'Acme Corp',
    job_location: 'Hyderabad, Telangana',
    job_city: 'Hyderabad',
    job_state: 'Telangana',
    job_country: 'IN',
    job_is_remote: false,
    job_description: 'Lead a team of engineers.',
    job_posted_at_timestamp: 1787270400,
    job_min_salary: null,
    job_max_salary: null,
  }

  it('normalizes the documented shape (data as a plain array)', () => {
    const out = normalizeJSearchResponse({ data: [rawJob] })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      title: 'Engineering Manager',
      url: 'https://in.linkedin.com/jobs/view/engineering-manager-123',
      company: 'Acme Corp',
      location: 'Hyderabad, Telangana',
      description: 'Lead a team of engineers.',
      isRemote: false,
      postedAt: 1787270400000,
      salary: null,
    })
  })

  it('also normalizes the { data: { jobs: [...] } } shape seen in a real manual pull', () => {
    const out = normalizeJSearchResponse({ data: { jobs: [rawJob] } })
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Engineering Manager')
  })

  it('falls back to city/state/country when job_location is blank', () => {
    const out = normalizeJSearchResponse({ data: [{ ...rawJob, job_location: null }] })
    expect(out[0].location).toBe('Hyderabad, Telangana, IN')
  })

  it('maps salary using the country currency table when both min and max are present', () => {
    const out = normalizeJSearchResponse({ data: [{ ...rawJob, job_min_salary: 2000000, job_max_salary: 3500000 }] })
    expect(out[0].salary).toEqual({ min: 2000000, max: 3500000, currency: 'INR' })
  })

  it('drops rows with no apply link and returns [] for an unrecognized shape', () => {
    expect(normalizeJSearchResponse({ data: [{ job_title: 'No link' }] })).toEqual([])
    expect(normalizeJSearchResponse({})).toEqual([])
    expect(normalizeJSearchResponse(null)).toEqual([])
  })
})
