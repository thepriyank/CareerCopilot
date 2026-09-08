import { buildResumeHtml } from '../../src/services/documents/resumeTemplate'
import { ExtractedEntities } from '../../src/types'

const sample: ExtractedEntities = {
  contact: {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    linkedin: 'linkedin.com/in/priyasharma',
  },
  summary: 'Backend engineer with a focus on scaling systems <fast> & reliably.',
  experience: [
    {
      id: '1',
      company: 'Acme & Co',
      title: 'Senior Backend Engineer',
      startDate: '2022',
      endDate: undefined,
      current: true,
      bullets: ['Cut p99 latency by 40%', 'Led migration to Kubernetes'],
    },
  ],
  education: [
    { id: '1', institution: 'IIT Bombay', degree: 'B.Tech', field: 'Computer Science', endDate: '2018' },
  ],
  skills: [
    { id: '1', name: 'TypeScript', category: 'Languages' },
    { id: '2', name: 'PostgreSQL', category: 'Databases' },
  ],
  certifications: [],
  projects: [],
}

describe('buildResumeHtml', () => {
  it('escapes HTML-significant characters in user content', () => {
    const html = buildResumeHtml(sample)
    expect(html).toContain('&lt;fast&gt;')
    expect(html).toContain('Acme &amp; Co')
    expect(html).not.toContain('<fast>')
  })

  it('renders contact details with sanitized hrefs', () => {
    const html = buildResumeHtml(sample)
    expect(html).toContain('href="mailto:priya@example.com"')
    expect(html).toContain('href="tel:+919876543210"')
    expect(html).toContain('href="https://linkedin.com/in/priyasharma"')
  })

  it('rejects a javascript: scheme smuggled into a contact field', () => {
    const malicious: ExtractedEntities = {
      ...sample,
      contact: { ...sample.contact, website: 'javascript:alert(1)' },
    }
    const html = buildResumeHtml(malicious)
    expect(html).not.toContain('href="javascript:alert(1)"')
  })

  it('omits a section entirely when its data is empty', () => {
    const minimal: ExtractedEntities = {
      contact: { name: 'Test' },
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      projects: [],
    }
    const html = buildResumeHtml(minimal)
    expect(html).not.toContain('class="section-title">Skills')
    expect(html).not.toContain('class="section-title">Experience')
  })

  it('groups skills by category', () => {
    const html = buildResumeHtml(sample)
    expect(html).toContain('Languages:')
    expect(html).toContain('Databases:')
  })
})
