import { buildCoverLetterHtml, CoverLetterPayload } from '../../src/services/documents/coverLetterTemplate'

const fixture: CoverLetterPayload = {
  candidate: {
    name: 'Priya Sharma',
    location: 'Bengaluru, India',
    email: 'priya@example.com',
    phone: '+91 98765 43210',
    linkedin: 'linkedin.com/in/priyasharma',
  },
  letter: {
    role_title: 'Senior Backend Engineer',
    company: 'Acme & Co',
    city: 'Bengaluru',
    date: '2026-07-18',
    greeting: 'Dear Hiring Team,',
    opening: 'I am excited to apply for the Senior Backend Engineer role at Acme.',
    profile_intro: 'I bring 6 years of experience scaling backend systems <at pace>.',
    achievements: [{ lead: 'Cut p99 latency by 40%', impact: 'across the payments service' }],
    closing: 'Thank you for your consideration.',
    footnotes: ['Portfolio available on request.'],
  },
}

describe('buildCoverLetterHtml', () => {
  it('fills every token and leaves none unresolved', () => {
    const html = buildCoverLetterHtml(fixture)
    expect(html).not.toMatch(/\{\{[A-Z_]+\}\}/)
  })

  it('escapes HTML-significant characters from user content', () => {
    const html = buildCoverLetterHtml(fixture)
    expect(html).toContain('Acme &amp; Co')
    expect(html).toContain('&lt;at pace&gt;')
    expect(html).not.toContain('<at pace>')
  })

  it('renders contact details with a mailto link', () => {
    const html = buildCoverLetterHtml(fixture)
    expect(html).toContain('href="mailto:priya@example.com"')
  })

  it('omits optional blocks (achievements, footnotes) when absent', () => {
    const minimal: CoverLetterPayload = {
      candidate: { name: 'Test Candidate' },
      letter: {
        role_title: 'Engineer',
        opening: 'Opening line.',
        profile_intro: 'Intro line.',
      },
    }
    const html = buildCoverLetterHtml(minimal)
    expect(html).not.toContain('class="achievements"')
    expect(html).not.toContain('class="footnotes"')
  })

  it('throws when a required field is missing', () => {
    const broken = { candidate: { name: 'Test' }, letter: { role_title: 'Engineer' } } as unknown as CoverLetterPayload
    expect(() => buildCoverLetterHtml(broken)).toThrow(/Missing required field/)
  })
})
