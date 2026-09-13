import { isSoftwareEngineeringRole } from '../../src/services/jobs/isSoftwareEngineeringRole'

describe('isSoftwareEngineeringRole', () => {
  const included: string[] = [
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
  ]

  const excluded: string[] = [
    'Executive Personal Assistant to the Founder (Remote, UAE or Europe)',
    'Sales Engineer',
    'Customer Success Engineer',
    'Field Service Engineer',
    'Network Engineer',
    'Mechanical Engineer',
    'Product Manager',
    'Project Manager',
    'Marketing Manager',
    'HR Generalist',
    'Executive Assistant',
    'Recruiter',
    'Accountant',
    'Legal Counsel',
    '',
  ]

  it.each(included)('includes "%s"', (title) => {
    expect(isSoftwareEngineeringRole(title)).toBe(true)
  })

  it.each(excluded)('excludes "%s"', (title) => {
    expect(isSoftwareEngineeringRole(title)).toBe(false)
  })

  it('handles null/undefined without throwing', () => {
    expect(isSoftwareEngineeringRole(null)).toBe(false)
    expect(isSoftwareEngineeringRole(undefined)).toBe(false)
  })
})
