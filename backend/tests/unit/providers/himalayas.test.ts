import { parseHimalayasResponse } from '../../../src/services/jobs/providers/himalayas'

describe('parseHimalayasResponse', () => {
  it('normalizes a job with applicationLink and location restrictions', () => {
    const json = {
      jobs: [
        {
          title: 'Backend Engineer',
          companyName: 'Acme',
          locationRestrictions: ['India', 'Worldwide'],
          applicationLink: 'https://himalayas.app/jobs/acme-backend',
          pubDate: 1750000000,
        },
      ],
    }
    const jobs = parseHimalayasResponse(json)
    expect(jobs[0]).toMatchObject({
      title: 'Backend Engineer',
      company: 'Acme',
      url: 'https://himalayas.app/jobs/acme-backend',
      location: 'India, Worldwide',
      postedAt: 1750000000000,
    })
  })

  it('falls back to guid when applicationLink is absent, and drops entries with neither', () => {
    const json = {
      jobs: [
        { title: 'A', guid: 'https://himalayas.app/jobs/a' },
        { title: 'B' },
      ],
    }
    const jobs = parseHimalayasResponse(json)
    expect(jobs).toHaveLength(1)
    expect(jobs[0].url).toBe('https://himalayas.app/jobs/a')
  })

  it('rejects a URL not hosted on himalayas.app', () => {
    const json = { jobs: [{ title: 'A', applicationLink: 'https://evil.example/a' }] }
    expect(parseHimalayasResponse(json)).toHaveLength(0)
  })

  it('returns [] for a malformed response shape', () => {
    expect(parseHimalayasResponse(null)).toEqual([])
    expect(parseHimalayasResponse({})).toEqual([])
  })
})
