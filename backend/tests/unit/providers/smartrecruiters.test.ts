import smartrecruiters, { parseSmartRecruitersResponse } from '../../../src/services/jobs/providers/smartrecruiters'

describe('parseSmartRecruitersResponse', () => {
  it('prefers fullLocation and rewrites the api ref to a public jobs URL', () => {
    const json = {
      content: [
        {
          id: '1',
          name: 'Backend Engineer',
          ref: 'https://api.smartrecruiters.com/v1/companies/acme/postings/1',
          location: { fullLocation: 'Bengaluru, India', remote: true },
        },
      ],
    }
    const parsed = parseSmartRecruitersResponse(json, 'Acme')
    expect(parsed[0]).toMatchObject({
      title: 'Backend Engineer',
      url: 'https://jobs.smartrecruiters.com/acme/postings/1',
      location: 'Bengaluru, India, Remote',
      company: 'Acme',
    })
  })

  it('assembles a location from city/region/country when fullLocation is absent', () => {
    const json = { content: [{ name: 'X', location: { city: 'Pune', country: 'India' } }] }
    expect(parseSmartRecruitersResponse(json, 'Acme')[0].location).toBe('Pune, India')
  })

  it('returns [] when content is missing or not an array', () => {
    expect(parseSmartRecruitersResponse({}, 'Acme')).toEqual([])
    expect(parseSmartRecruitersResponse({ content: null }, 'Acme')).toEqual([])
  })
})

describe('smartrecruiters provider', () => {
  it('detect() resolves careers.smartrecruiters.com/<slug>', () => {
    const hit = smartrecruiters.detect({ name: 'Acme', careersUrl: 'https://careers.smartrecruiters.com/Acme' })
    expect(hit?.url).toContain('https://api.smartrecruiters.com/v1/companies/Acme/postings')
  })

  it('fetch() paginates until a short page is returned', async () => {
    const pageOf = (n: number) => ({
      content: Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Job ${i}` })),
    })
    let calls = 0
    const fetched = await smartrecruiters.fetch(
      { name: 'Acme', careersUrl: 'https://careers.smartrecruiters.com/Acme' },
      {
        fetchJson: async () => {
          calls++
          return calls === 1 ? pageOf(100) : pageOf(10) // full page, then a short page → stop
        },
        fetchText: async () => '',
      }
    )
    expect(calls).toBe(2)
    expect(fetched).toHaveLength(110)
  })
})
