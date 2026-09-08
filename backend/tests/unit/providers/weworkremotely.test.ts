import { parseWwrFeed } from '../../../src/services/jobs/providers/weworkremotely'

describe('parseWwrFeed', () => {
  it('splits "Company: Title" into separate fields', () => {
    const xml = `<rss><channel>
      <item>
        <title>Acme: Senior Backend Engineer</title>
        <link>https://weworkremotely.com/remote-jobs/1</link>
        <region>Anywhere in the World</region>
        <pubDate>Wed, 01 Jul 2026 09:30:00 +0000</pubDate>
      </item>
    </channel></rss>`
    const jobs = parseWwrFeed(xml)
    expect(jobs[0]).toMatchObject({
      company: 'Acme',
      title: 'Senior Backend Engineer',
      url: 'https://weworkremotely.com/remote-jobs/1',
      location: 'Anywhere in the World',
    })
    expect(jobs[0].postedAt).toBeGreaterThan(0)
  })

  it('falls back to the default company when the title has no colon split', () => {
    const xml = `<rss><channel><item>
      <title>Senior Backend Engineer</title>
      <link>https://weworkremotely.com/remote-jobs/2</link>
    </item></channel></rss>`
    const jobs = parseWwrFeed(xml, 'Fallback Co')
    expect(jobs[0].company).toBe('Fallback Co')
  })

  it('drops an item whose link is not on the trusted host', () => {
    const xml = `<rss><channel><item>
      <title>Acme: Engineer</title>
      <link>https://evil.example/remote-jobs/3</link>
    </item></channel></rss>`
    expect(parseWwrFeed(xml)).toHaveLength(0)
  })

  it('unwraps a CDATA-wrapped title as literal text (no entity decoding inside CDATA)', () => {
    const xml = `<rss><channel><item>
      <title><![CDATA[Acme & Co: Backend Engineer]]></title>
      <link>https://weworkremotely.com/remote-jobs/4</link>
    </item></channel></rss>`
    const jobs = parseWwrFeed(xml)
    expect(jobs[0].company).toBe('Acme & Co')
  })

  it('decodes XML entities in a non-CDATA title', () => {
    const xml = `<rss><channel><item>
      <title>Acme &amp; Co: Backend Engineer</title>
      <link>https://weworkremotely.com/remote-jobs/5</link>
    </item></channel></rss>`
    const jobs = parseWwrFeed(xml)
    expect(jobs[0].company).toBe('Acme & Co')
  })
})
