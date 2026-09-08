import ashby, { parseCompensation } from '../../../src/services/jobs/providers/ashby'

describe('ashby provider', () => {
  it('detect() resolves jobs.ashbyhq.com/<slug> to the posting-api endpoint', () => {
    const hit = ashby.detect({ name: 'Acme', careersUrl: 'https://jobs.ashbyhq.com/acme' })
    expect(hit?.url).toBe('https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true')
  })

  it('detect() rejects an untrusted api: host', () => {
    expect(ashby.detect({ name: 'Evil', api: 'https://evil.example/posting-api/job-board/acme' })).toBeNull()
  })

  it('fetch() normalizes jobs and formats secondary locations', async () => {
    const sample = {
      jobs: [
        {
          title: 'Product Designer',
          jobUrl: 'https://jobs.ashbyhq.com/acme/123',
          location: 'Remote',
          secondaryLocations: [{ location: 'Bengaluru', address: { postalAddress: { addressCountry: 'India' } } }],
          publishedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    }
    const fetched = await ashby.fetch(
      { name: 'Acme', careersUrl: 'https://jobs.ashbyhq.com/acme' },
      { fetchJson: async () => sample, fetchText: async () => '' }
    )
    expect(fetched[0].title).toBe('Product Designer')
    expect(fetched[0].location).toContain('Bengaluru')
    expect(fetched[0].location).toContain('India')
  })

  it('fetch() retries with backoff and eventually throws the last error', async () => {
    let attempts = 0
    await expect(
      ashby.fetch(
        { name: 'Acme', careersUrl: 'https://jobs.ashbyhq.com/acme' },
        {
          fetchJson: async () => { attempts++; throw new Error('boom') },
          fetchText: async () => '',
          sleep: async () => undefined, // skip real backoff delay in tests
        }
      )
    ).rejects.toThrow('boom')
    expect(attempts).toBe(3) // initial attempt + 2 retries
  })
})

describe('parseCompensation', () => {
  it('annualizes a monthly compensation range', () => {
    const result = parseCompensation({ interval: '1 MONTH', minValue: 100000, maxValue: 150000, currency: 'inr' })
    expect(result).toEqual({ min: 1_200_000, max: 1_800_000, currency: 'INR' })
  })

  it('returns null when neither min nor max is present', () => {
    expect(parseCompensation({ interval: '1 YEAR' })).toBeNull()
  })

  it('returns null for an unrecognized interval', () => {
    expect(parseCompensation({ interval: 'bogus', minValue: 1 })).toBeNull()
  })
})
