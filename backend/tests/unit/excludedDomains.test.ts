import { isExcludedHost } from '../../src/services/extension/excludedDomains'

describe('isExcludedHost', () => {
  it.each([
    'linkedin.com',
    'www.linkedin.com',
    'in.linkedin.com',
    'naukri.com',
    'www.naukri.com',
    'indeed.com',
    'in.indeed.com',
    'glassdoor.com',
    'www.glassdoor.co.in',
    'wellfound.com',
    'angel.co',
  ])('blocks %s', (host) => {
    expect(isExcludedHost(host)).toBe(true)
  })

  it.each([
    'boards.greenhouse.io',
    'jobs.lever.co',
    'careers.smartrecruiters.com',
    'acme.wd1.myworkdayjobs.com',
    'example.com',
  ])('allows %s', (host) => {
    expect(isExcludedHost(host)).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isExcludedHost('LinkedIn.com')).toBe(true)
  })

  it('does not false-positive on a host that merely contains the suffix as a substring', () => {
    expect(isExcludedHost('notlinkedin.com')).toBe(false)
    expect(isExcludedHost('linkedin.com.evil.example')).toBe(false)
  })
})
