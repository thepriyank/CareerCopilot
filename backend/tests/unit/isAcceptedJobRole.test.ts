import { isAcceptedJobRole } from '../../src/services/jobs/isAcceptedJobRole'

describe('isAcceptedJobRole', () => {
  const included: string[] = [
    // Software engineering
    'Software Engineer',
    'Senior Software Engineer',
    'Backend Engineer (Node.js & Typescript)',
    'Frontend Engineer',
    'Full Stack Developer / AI Engineer',
    'Staff Backend Engineer',
    'Lead Full Stack Engineer (Ruby on Rails + React)',
    'Engineering Manager, Full Stack - Gen AI (India)',
    'Data Engineer',
    'Platform Engineer',
    'DevOps Engineer',
    'Site Reliability Engineer',
    'QA Engineer',
    'SDET',
    'iOS Developer',
    'Android Engineer',
    'Machine Learning Engineer',
    'Principal Engineer',
    'Technical Lead',
    'SDE I - Backend',
    // Other trending tech roles
    'Cloud Solutions Architect',
    'Cybersecurity Analyst',
    'Security Engineer',
    'MLOps Engineer',
    'Data Scientist',
    'Data Analyst',
    'UX Designer',
    'Product Designer',
    // Trending corporate roles
    'Product Manager',
    'Senior Product Manager, Payments',
    'Business Analyst',
    'Financial Analyst',
    'Growth Marketing Manager',
    'Digital Marketing Manager',
    'Customer Success Manager',
    'HR Business Partner',
    'People Operations Lead',
    'Revenue Operations Manager',
  ]

  const excluded: string[] = [
    'Executive Personal Assistant to the Founder (Remote, UAE or Europe)',
    'Sales Engineer',
    'Customer Success Engineer',
    'Field Service Engineer',
    'Network Engineer',
    'Mechanical Engineer',
    'Project Manager',
    'Program Manager',
    'HR Generalist',
    'Executive Assistant',
    'Recruiter',
    'Accountant',
    'Legal Counsel',
    '',
  ]

  it.each(included)('includes "%s"', (title) => {
    expect(isAcceptedJobRole(title)).toBe(true)
  })

  it.each(excluded)('excludes "%s"', (title) => {
    expect(isAcceptedJobRole(title)).toBe(false)
  })

  it('handles null/undefined without throwing', () => {
    expect(isAcceptedJobRole(null)).toBe(false)
    expect(isAcceptedJobRole(undefined)).toBe(false)
  })
})
