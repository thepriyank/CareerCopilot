import { toJobView } from '../../src/services/jobs/jobView'
import { UserJob } from '../../src/entities/UserJob'
import { JobListing } from '../../src/entities/JobListing'
import { JobOrigin } from '../../src/entities/enums'

describe('toJobView', () => {
  it('maps a UserJob + its JobListing into the flat shape routes return', () => {
    const createdAt = new Date('2026-01-01')
    const userJob = {
      id: 'userjob-1',
      userId: 'user-1',
      jobListingId: 'listing-1',
      origin: JobOrigin.DISCOVERED,
      createdAt,
    } as UserJob

    const listing = {
      id: 'listing-1',
      source: 'jsearch',
      url: 'https://example.com/jobs/1',
      urlHash: 'abc123',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Bengaluru',
      salary: '10,00,000 - 15,00,000',
      description: 'Build things.',
      normalizedFields: { seniorityLevel: 'Senior' },
      skills: ['Python', 'Kubernetes'],
      experienceLevel: 'senior',
      isRemote: false,
      postedAt: null,
      firstSeenAt: createdAt,
      lastSeenAt: createdAt,
    } as unknown as JobListing

    const view = toJobView(userJob, listing)

    // id is the UserJob's id — what routes and other tables' jobId columns
    // reference — not the JobListing's id (that's jobListingId instead).
    expect(view.id).toBe('userjob-1')
    expect(view.jobListingId).toBe('listing-1')
    expect(view.userId).toBe('user-1')
    expect(view.createdAt).toBe(createdAt) // the user's own createdAt, not the listing's firstSeenAt
    expect(view).toMatchObject({
      source: 'jsearch',
      url: 'https://example.com/jobs/1',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Bengaluru',
      salary: '10,00,000 - 15,00,000',
      description: 'Build things.',
      normalizedFields: { seniorityLevel: 'Senior' },
      skills: ['Python', 'Kubernetes'],
      experienceLevel: 'senior',
      isRemote: false,
    })
  })

  it('defaults matchScore to null, and carries whatever score is passed in', () => {
    const userJob = { id: 'uj-1', userId: 'user-1', jobListingId: 'l-1', createdAt: new Date() } as UserJob
    const listing = { id: 'l-1', skills: [] } as unknown as JobListing

    expect(toJobView(userJob, listing).matchScore).toBeNull()
    expect(toJobView(userJob, listing, 87).matchScore).toBe(87)
  })
})
