import { computeMatchScore, parseSalaryRange, detectCurrencyCode, MatchableJob } from '../../src/services/matching/matchScore'
import { CandidateProfile } from '../../src/entities/CandidateProfile'
import { RemotePreference } from '../../src/entities/enums'

describe('parseSalaryRange', () => {
  it('parses a plain numeric range with commas', () => {
    expect(parseSalaryRange('1,200,000 - 1,800,000')).toEqual({ min: 1_200_000, max: 1_800_000 })
  })

  it('understands k (thousands) suffixes', () => {
    expect(parseSalaryRange('$120k - $150k')).toEqual({ min: 120_000, max: 150_000 })
  })

  it('understands lakh/L suffixes common in Indian postings', () => {
    expect(parseSalaryRange('₹12L - ₹18L')).toEqual({ min: 1_200_000, max: 1_800_000 })
  })

  it('returns null when nothing numeric is present', () => {
    expect(parseSalaryRange('Competitive, based on experience')).toBeNull()
  })
})

describe('detectCurrencyCode', () => {
  it('recognizes ₹/Rs/INR/LPA as INR', () => {
    expect(detectCurrencyCode('₹12L - ₹18L')).toBe('INR')
    expect(detectCurrencyCode('Rs. 12,00,000')).toBe('INR')
    expect(detectCurrencyCode('18 LPA')).toBe('INR')
  })

  it('recognizes $/USD as USD', () => {
    expect(detectCurrencyCode('$120k - $150k')).toBe('USD')
  })

  it('returns null when no currency marker is present', () => {
    expect(detectCurrencyCode('1,200,000 - 1,800,000')).toBeNull()
  })
})

// Job skills/seniority/years/salary are AI-extracted once at ingestion
// (services/skills/extractJobSkills.ts) and persisted on JobListing —
// matchScore.ts just compares that structured data against the résumé/
// profile, no live extraction from `description` any more. MatchableJob is
// structural, so this same shape works whether the caller has a full
// JobView (a candidate's already-attached job) or a raw JobListing (the
// shared pool, before any candidate has it — see surfaceJobs.ts).
function buildJob(overrides: Partial<MatchableJob> = {}): MatchableJob {
  return {
    location: 'Bengaluru, India',
    salary: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    experienceLevel: 'staff',
    minYearsExperience: 8,
    maxYearsExperience: 12,
    description:
      'We are looking for a backend engineer to join our platform team, deploying production services on Kubernetes and writing Python microservices for payments. Rust experience is a plus.',
    isRemote: false,
    skills: ['Python', 'Kubernetes', 'Rust'],
    ...overrides,
  }
}

function buildProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: 'profile-1',
    userId: 'user-1',
    targetRoles: ['Staff Engineer'],
    industries: [],
    locations: ['Bengaluru'],
    avoidTechnologies: [],
    remotePreference: RemotePreference.OPEN,
    yearsOfExperience: 10,
    salaryMin: 4_000_000,
    salaryMax: 5_500_000,
    salaryCurrency: 'INR',
    urgency: 'ACTIVELY_LOOKING' as any,
    noticePeriod: null,
    visaStatus: null,
    summary: null,
    completionScore: 100,
    onboardingState: 'DONE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CandidateProfile
}

const strongResumeSkills = ['Python', 'Kubernetes', 'PostgreSQL']

describe('computeMatchScore', () => {
  it('scores a perfect skill + seniority + location + salary match at (or near) 100', () => {
    const result = computeMatchScore(
      ['Python', 'Kubernetes', 'Rust'],
      buildJob({ salaryMin: 4_500_000, salaryMax: 5_500_000, salaryCurrency: 'INR' }),
      buildProfile()
    )
    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.rationale.skillCoverage).toBe(1)
    expect(result.rationale.seniorityFit).toBe(1)
    expect(result.rationale.experienceFit).toBe('closely-matched')
    expect(result.rationale.locationFit).toBe('location-match')
    expect(result.rationale.salaryFit).toBe('within-range')
  })

  it('scores a strong skill + location match highly, reporting the real skill gap', () => {
    const result = computeMatchScore(
      strongResumeSkills,
      buildJob({ salaryMin: 4_500_000, salaryMax: 5_500_000, salaryCurrency: 'INR' }),
      buildProfile()
    )
    expect(result.score).toBeGreaterThan(50)
    expect(result.rationale.matchedSkills).toEqual(expect.arrayContaining(['Python', 'Kubernetes']))
    expect(result.rationale.missingSkills).toContain('Rust')
    expect(result.gaps).toContain('Rust')
    expect(result.rationale.locationFit).toBe('location-match')
    expect(result.rationale.salaryFit).toBe('within-range')
  })

  it('matches skill names case-insensitively, reporting the job\'s own casing', () => {
    const result = computeMatchScore(['python', 'KUBERNETES'], buildJob(), buildProfile())
    expect(result.rationale.matchedSkills).toEqual(expect.arrayContaining(['Python', 'Kubernetes']))
  })

  it('scores a job with no matching skills at all low', () => {
    const result = computeMatchScore([], buildJob(), buildProfile())
    expect(result.score).toBeLessThan(40)
  })

  it('treats remote roles as a location fit when the profile is remote-open', () => {
    const result = computeMatchScore(
      strongResumeSkills,
      buildJob({ isRemote: true, location: 'Worldwide' }),
      buildProfile({ locations: ['New York'], remotePreference: RemotePreference.REMOTE })
    )
    expect(result.rationale.locationFit).toBe('remote-ok')
  })

  it('degrades to "unknown" signals gracefully when there is no profile at all', () => {
    const result = computeMatchScore(strongResumeSkills, buildJob(), null)
    expect(result.rationale.locationFit).toBe('unknown')
    expect(result.rationale.salaryFit).toBe('unknown')
    expect(result.rationale.experienceFit).toBe('unknown')
    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('does not crash on a job with no extracted skills, and scores it below a genuine partial skill match', () => {
    const noSkillsResult = computeMatchScore(strongResumeSkills, buildJob({ skills: [] }), buildProfile())
    expect(noSkillsResult.gaps).toEqual([])
    expect(Number.isFinite(noSkillsResult.score)).toBe(true)
    expect(noSkillsResult.rationale.skillCoverage).toBe(0.3)

    const partialMatchResult = computeMatchScore(['Python'], buildJob({ skills: ['Python', 'Kubernetes', 'Rust'] }), buildProfile())
    expect(partialMatchResult.score).toBeGreaterThan(noSkillsResult.score)
  })

  describe('computeSkillCoverage fuzzy matching (via computeMatchScore)', () => {
    it('matches suffix/prefix skill-name variants (e.g. "React" / "React.js")', () => {
      const result = computeMatchScore(['React'], buildJob({ skills: ['React.js'] }), buildProfile())
      expect(result.rationale.matchedSkills).toEqual(['React.js'])
      expect(result.rationale.missingSkills).toEqual([])
    })

    it('matches near-synonymous leadership phrasing via the alias table — the real regression case', () => {
      const result = computeMatchScore(['Technical leadership'], buildJob({ skills: ['People Leadership'] }), buildProfile())
      expect(result.rationale.matchedSkills).toEqual(['People Leadership'])
    })

    it('matches common abbreviation <-> full-name pairs via the alias table (K8s / Kubernetes)', () => {
      const result = computeMatchScore(['Kubernetes'], buildJob({ skills: ['K8s'] }), buildProfile())
      expect(result.rationale.matchedSkills).toEqual(['K8s'])
    })

    it('does not let a short skill name false-positive-match as a substring of an unrelated word', () => {
      const result = computeMatchScore(['ai'], buildJob({ skills: ['Rails'] }), buildProfile())
      expect(result.rationale.matchedSkills).toEqual([])
      expect(result.rationale.missingSkills).toEqual(['Rails'])
    })
  })

  // 2026-09-21: the headline case this v4 redesign exists to fix — a highly
  // experienced candidate with 100% skill overlap against a junior/intern
  // role must NOT score as a high match, because skills alone used to be
  // enough (v3's failure mode this whole rewrite was reported for).
  describe('seniority gate — the real reported bug', () => {
    it('scores a 100%-skill-match Intern/Junior role low for a 10-YOE Staff-track candidate', () => {
      const juniorJob = buildJob({
        experienceLevel: 'entry',
        minYearsExperience: 0,
        maxYearsExperience: 2,
        skills: ['Python', 'SQL'],
      })
      const result = computeMatchScore(['Python', 'SQL', 'Kubernetes', 'Leadership'], juniorJob, buildProfile({ yearsOfExperience: 10 }))
      expect(result.rationale.skillCoverage).toBe(1) // skills alone would say "perfect match"
      expect(result.rationale.experienceFit).toBe('overqualified')
      expect(result.rationale.seniorityFit).toBeLessThan(0.3)
      expect(result.score).toBeLessThan(38) // below config.matching.minScoreToSurface — never surfaced
    })

    it('is symmetric: an underqualified candidate against a senior role is penalized the same way', () => {
      const staffJob = buildJob({ experienceLevel: 'staff', minYearsExperience: 8, maxYearsExperience: 12 })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], staffJob, buildProfile({ yearsOfExperience: 1 }))
      expect(result.rationale.experienceFit).toBe('underqualified')
      expect(result.rationale.seniorityFit).toBeLessThan(0.3)
    })

    it('treats a 1-2 year gap as still closely matched, not penalized', () => {
      const seniorJob = buildJob({ experienceLevel: 'senior', minYearsExperience: 5, maxYearsExperience: 8 })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], seniorJob, buildProfile({ yearsOfExperience: 9 }))
      expect(result.rationale.experienceFit).toBe('closely-matched')
      expect(result.rationale.seniorityFit).toBe(1)
    })

    it('falls back to the tier-based band when the JD states no explicit years', () => {
      const internJob = buildJob({ experienceLevel: 'intern', minYearsExperience: null, maxYearsExperience: null })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], internJob, buildProfile({ yearsOfExperience: 10 }))
      expect(result.rationale.experienceFit).toBe('overqualified')
    })

    it('does not penalize when the candidate has not stated years of experience yet', () => {
      const juniorJob = buildJob({ experienceLevel: 'entry', minYearsExperience: 0, maxYearsExperience: 2 })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], juniorJob, buildProfile({ yearsOfExperience: null }))
      expect(result.rationale.experienceFit).toBe('unknown')
      expect(result.rationale.seniorityFit).toBeGreaterThan(0.5)
    })
  })

  describe('salary gate', () => {
    it('scores a job paying well below the candidate\'s minimum low, even with perfect skills', () => {
      const lowPayJob = buildJob({ salaryMin: 600_000, salaryMax: 800_000, salaryCurrency: 'INR' })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], lowPayJob, buildProfile())
      expect(result.rationale.salaryFit).toBe('below-range')
      expect(result.rationale.salaryFitScore).toBeLessThan(0.5)
    })

    it('never penalizes a job paying more than the candidate asked for', () => {
      const highPayJob = buildJob({ salaryMin: 8_000_000, salaryMax: 10_000_000, salaryCurrency: 'INR' })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], highPayJob, buildProfile())
      expect(result.rationale.salaryFit).toBe('above-range')
      expect(result.rationale.salaryFitScore).toBe(1)
    })

    it('does not penalize when the job discloses no salary at all', () => {
      const noSalaryJob = buildJob({ salaryMin: null, salaryMax: null, salaryCurrency: null })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], noSalaryJob, buildProfile())
      expect(result.rationale.salaryFit).toBe('unknown')
      expect(result.rationale.salaryFitScore).toBeGreaterThan(0.5)
    })

    it('treats a currency mismatch as unknown rather than comparing raw numbers across currencies', () => {
      const usdJob = buildJob({ salaryMin: 40_000, salaryMax: 60_000, salaryCurrency: 'USD' })
      const result = computeMatchScore(['Python', 'Kubernetes', 'Rust'], usdJob, buildProfile({ salaryCurrency: 'INR' }))
      expect(result.rationale.salaryFit).toBe('unknown')
    })
  })

  describe('location — negotiable, never a hard gate', () => {
    it('still scores reasonably even on a location mismatch, given a strong match otherwise', () => {
      const result = computeMatchScore(
        ['Python', 'Kubernetes', 'Rust'],
        buildJob({ salaryMin: 4_500_000, salaryMax: 5_500_000, salaryCurrency: 'INR' }),
        buildProfile({ locations: ['Mumbai'] })
      )
      expect(result.rationale.locationFit).toBe('location-mismatch')
      expect(result.score).toBeGreaterThanOrEqual(80) // location costs a little, not a gate
    })
  })
})
