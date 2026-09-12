import { computeMatchScore, parseSalaryRange, MatchableJob } from '../../src/services/matching/matchScore'
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

// Job skills are AI-extracted once at ingestion (services/skills/extractJobSkills.ts)
// and persisted on JobListing.skills — matchScore.ts just compares this list
// against the résumé's own skills, no live extraction from `description` any more.
// MatchableJob is structural, so this same shape works whether the caller has
// a full JobView (a candidate's already-attached job) or a raw JobListing
// (the shared pool, before any candidate has it — see surfaceJobs.ts).
function buildJob(overrides: Partial<MatchableJob> = {}): MatchableJob {
  return {
    location: 'Bengaluru, India',
    salary: null,
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
    targetRoles: ['Backend Engineer'],
    industries: [],
    locations: ['Bengaluru'],
    remotePreference: RemotePreference.OPEN,
    salaryMin: 1_000_000,
    salaryMax: 1_800_000,
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
  // 2026-09-13: whole-document text similarity was removed from the formula
  // by explicit product decision — a real case showed 100% skill coverage
  // still landing around 60% overall purely because of a weak lexical
  // signal, with skills/preferences (the things that actually determine
  // relevance) diluted by a much larger, blunter weight. This is the
  // headline case the removal exists to fix: full skill + preference match
  // now scores at (or very near) 100, not held back by anything else.
  it('scores a perfect skill + location + salary match at (or near) 100 — the case that prompted removing text similarity', () => {
    const result = computeMatchScore(
      ['Python', 'Kubernetes', 'Rust'],
      buildJob({ salary: '12,00,000 - 18,00,000' }),
      buildProfile()
    )
    expect(result.score).toBeGreaterThanOrEqual(95)
    expect(result.rationale.skillCoverage).toBe(1)
    expect(result.rationale.preferenceFit).toBe(1)
    expect(result.rationale.locationFit).toBe('location-match')
    expect(result.rationale.salaryFit).toBe('within-range')
  })

  it('scores a strong skill + location match highly, reporting the real skill gap', () => {
    const result = computeMatchScore(strongResumeSkills, buildJob({ salary: '12,00,000 - 18,00,000' }), buildProfile())
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
    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('does not crash on a job with no extracted skills, and scores it below a genuine partial skill match', () => {
    const noSkillsResult = computeMatchScore(strongResumeSkills, buildJob({ skills: [] }), buildProfile())
    expect(noSkillsResult.gaps).toEqual([])
    expect(Number.isFinite(noSkillsResult.score)).toBe(true)
    expect(noSkillsResult.rationale.skillCoverage).toBe(0.3)

    // 2026-09-13 calibration finding: a job with zero verified skill data
    // must never outscore one with real, if partial, overlap — the old 0.5
    // neutral default did exactly that once skillCoverage became 2/3 of
    // the total weight (see computeSkillCoverage's comment).
    const partialMatchResult = computeMatchScore(['Python'], buildJob({ skills: ['Python', 'Kubernetes', 'Rust'] }), buildProfile())
    expect(partialMatchResult.score).toBeGreaterThan(noSkillsResult.score)
  })

  // 2026-09-12: a real diagnostic run (see git history / session notes) found
  // a genuinely strong Engineering Manager match scoring one point under the
  // surfacing threshold, entirely because the job's "People Leadership" and
  // the résumé's "Technical leadership" are the same fact worded differently
  // by two independent AI extractions — exact-string skill coverage counted
  // that as zero overlap. These lock in the fuzzy-matching fix.
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
})
