import greenhouse from '../../../src/services/jobs/providers/greenhouse'

describe('greenhouse provider', () => {
  it('has id "greenhouse"', () => {
    expect(greenhouse.id).toBe('greenhouse')
  })

  it('detect() resolves job-boards.greenhouse.io/<slug> to the boards-api jobs endpoint', () => {
    const hit = greenhouse.detect({ name: 'Acme', careersUrl: 'https://job-boards.greenhouse.io/acme' })
    expect(hit?.url).toBe('https://boards-api.greenhouse.io/v1/boards/acme/jobs')
  })

  it('detect() honors an allowlisted api: over a branded careers URL', () => {
    const hit = greenhouse.detect({
      name: 'Pinned',
      careersUrl: 'https://www.pinned.example/careers',
      api: 'https://boards-api.greenhouse.io/v1/boards/pinned/jobs',
    })
    expect(hit?.url).toBe('https://boards-api.greenhouse.io/v1/boards/pinned/jobs')
  })

  it('detect() rejects an untrusted api: host (SSRF guard)', () => {
    expect(greenhouse.detect({ name: 'Evil', api: 'https://evil.example/v1/boards/acme/jobs' })).toBeNull()
  })

  it('detect() rejects a non-HTTPS api:', () => {
    expect(greenhouse.detect({ name: 'Insecure', api: 'http://boards-api.greenhouse.io/v1/boards/acme/jobs' })).toBeNull()
  })

  it('detect() returns null for a non-greenhouse careers URL', () => {
    expect(greenhouse.detect({ name: 'X', careersUrl: 'https://example.com/careers' })).toBeNull()
  })

  it('fetch() requests the derived URL with redirect:"error" and normalizes the response', async () => {
    const sample = {
      jobs: [
        {
          id: 101,
          title: 'Senior Backend Engineer',
          absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/101',
          location: { name: 'Bengaluru, India' },
          first_published: '2026-07-01T09:30:00-04:00',
        },
        { id: 103, title: 'Ghost Role' }, // no absolute_url — dropped
      ],
    }
    let capturedUrl: string | undefined
    let capturedOpts: unknown
    const fetched = await greenhouse.fetch(
      { name: 'Acme', careersUrl: 'https://job-boards.greenhouse.io/acme' },
      { fetchJson: async (url, opts) => { capturedUrl = url; capturedOpts = opts; return sample }, fetchText: async () => '' }
    )

    expect(capturedUrl).toBe('https://boards-api.greenhouse.io/v1/boards/acme/jobs')
    expect(capturedOpts).toMatchObject({ redirect: 'error' })
    expect(fetched).toHaveLength(1)
    expect(fetched[0]).toMatchObject({
      title: 'Senior Backend Engineer',
      url: 'https://job-boards.greenhouse.io/acme/jobs/101',
      company: 'Acme',
      location: 'Bengaluru, India',
      postedAt: Date.parse('2026-07-01T09:30:00-04:00'),
    })
  })

  it('fetch() returns [] for a malformed response body without crashing', async () => {
    const fetched = await greenhouse.fetch(
      { name: 'Acme', careersUrl: 'https://job-boards.greenhouse.io/acme' },
      { fetchJson: async () => ({ jobs: null }), fetchText: async () => '' }
    )
    expect(fetched).toEqual([])
  })

  it('fetch() throws on an untrusted api: host before making any request', async () => {
    let called = false
    await expect(
      greenhouse.fetch(
        { name: 'Evil', api: 'https://evil.example/v1/boards/acme/jobs' },
        { fetchJson: async () => { called = true; return { jobs: [] } }, fetchText: async () => '' }
      )
    ).rejects.toThrow(/untrusted hostname/)
    expect(called).toBe(false)
  })
})
