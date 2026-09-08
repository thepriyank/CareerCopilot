import lever from '../../../src/services/jobs/providers/lever'

describe('lever provider', () => {
  it('detect() resolves jobs.lever.co/<slug> to the api.lever.co postings endpoint', () => {
    const hit = lever.detect({ name: 'Acme', careersUrl: 'https://jobs.lever.co/acme' })
    expect(hit?.url).toBe('https://api.lever.co/v0/postings/acme')
  })

  it('detect() resolves an EU careers URL to api.eu.lever.co', () => {
    const hit = lever.detect({ name: 'EuCo', careersUrl: 'https://jobs.eu.lever.co/euco' })
    expect(hit?.url).toBe('https://api.eu.lever.co/v0/postings/euco')
  })

  it('detect() rejects an untrusted api: host', () => {
    expect(lever.detect({ name: 'Evil', api: 'https://evil.example/v0/postings/acme' })).toBeNull()
  })

  it('fetch() normalizes the postings array with redirect:"error"', async () => {
    const sample = [
      {
        text: 'Staff Engineer',
        hostedUrl: 'https://jobs.lever.co/acme/abc',
        categories: { location: 'Remote - India' },
        descriptionPlain: 'Build things.',
        createdAt: 1735689600000,
      },
    ]
    let capturedOpts: unknown
    const fetched = await lever.fetch(
      { name: 'Acme', careersUrl: 'https://jobs.lever.co/acme' },
      { fetchJson: async (_url, opts) => { capturedOpts = opts; return sample }, fetchText: async () => '' }
    )
    expect(capturedOpts).toMatchObject({ redirect: 'error' })
    expect(fetched[0]).toMatchObject({
      title: 'Staff Engineer',
      url: 'https://jobs.lever.co/acme/abc',
      company: 'Acme',
      location: 'Remote - India',
      description: 'Build things.',
      postedAt: 1735689600000,
    })
  })

  it('fetch() returns [] when the response is not an array', async () => {
    const fetched = await lever.fetch(
      { name: 'Acme', careersUrl: 'https://jobs.lever.co/acme' },
      { fetchJson: async () => ({}), fetchText: async () => '' }
    )
    expect(fetched).toEqual([])
  })
})
