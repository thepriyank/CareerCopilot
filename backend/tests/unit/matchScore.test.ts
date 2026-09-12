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

const strongResumeText = `
Backend engineer with production experience.

Deployed services on Kubernetes and wrote Python microservices for payments.

# Skills
Python, Kubernetes, PostgreSQL
`
const strongResumeSkills = ['Python', 'Kubernetes', 'PostgreSQL']

describe('computeMatchScore', () => {
  it('scores a strong lexical + skill + location match highly', () => {
    const result = computeMatchScore(
      strongResumeText,
      strongResumeSkills,
      buildJob({ salary: '12,00,000 - 18,00,000' }),
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
    const result = computeMatchScore(strongResumeText, ['python', 'KUBERNETES'], buildJob(), buildProfile())
    expect(result.rationale.matchedSkills).toEqual(expect.arrayContaining(['Python', 'Kubernetes']))
  })

  // 2026-09-12: a real user saw 100% skill coverage ("no gaps found") but
  // only a 60% overall score, with no way to see why from the API response
  // — skillCoverage/preferenceFit weren't exposed, only lexicalSimilarity
  // was. These two lock in that both are now present and correct, so the
  // UI can show the actual weighted breakdown instead of a mystery number.
  it('exposes skillCoverage and preferenceFit on the rationale, not just lexicalSimilarity', () => {
    const result = computeMatchScore(
      strongResumeText,
      strongResumeSkills,
      buildJob({ skills: ['Python', 'Kubernetes'], salary: '12,00,000 - 18,00,000' }),
      buildProfile()
    )
    expect(result.rationale.skillCoverage).toBe(1)
    expect(result.rationale.preferenceFit).toBe(1)
    // A perfect skill+preference score still isn't a perfect total, because
    // lexicalSimilarity (55% weight) is a whole-document comparison, not a
    // skills-only one — this is the exact confusion the breakdown exists to
    // resolve, not a bug.
    expect(result.rationale.lexicalSimilarity).toBeLessThan(1)
    expect(result.score).toBeLessThan(100)
  })

  it('scores a weak / unrelated resume low', () => {
    const weakResumeText = 'Watercolor painting workshop instructor with 10 years of teaching experience.'
    const result = computeMatchScore(weakResumeText, [], buildJob(), buildProfile())
    expect(result.score).toBeLessThan(40)
  })

  it('treats remote roles as a location fit when the profile is remote-open', () => {
    const result = computeMatchScore(
      strongResumeText,
      strongResumeSkills,
      buildJob({ isRemote: true, location: 'Worldwide' }),
      buildProfile({ locations: ['New York'], remotePreference: RemotePreference.REMOTE })
    )
    expect(result.rationale.locationFit).toBe('remote-ok')
  })

  it('degrades to "unknown" signals gracefully when there is no profile at all', () => {
    const result = computeMatchScore(strongResumeText, strongResumeSkills, buildJob(), null)
    expect(result.rationale.locationFit).toBe('unknown')
    expect(result.rationale.salaryFit).toBe('unknown')
    expect(Number.isFinite(result.score)).toBe(true)
  })

  it('does not crash on a job with no extracted skills (neutral skill coverage)', () => {
    const result = computeMatchScore(strongResumeText, strongResumeSkills, buildJob({ skills: [] }), buildProfile())
    expect(result.gaps).toEqual([])
    expect(Number.isFinite(result.score)).toBe(true)
  })
})

// 2026-09-11: a real diagnostic run (see git history / session notes) found
// a genuinely strong Engineering Manager match scoring one point under the
// surfacing threshold, entirely because the job's "People Leadership" and
// the résumé's "Technical leadership" are the same fact worded differently
// by two independent AI extractions — exact-string skill coverage counted
// that as zero overlap. These lock in the fuzzy-matching fix.
describe('computeSkillCoverage fuzzy matching (via computeMatchScore)', () => {
  it('matches suffix/prefix skill-name variants (e.g. "React" / "React.js")', () => {
    const result = computeMatchScore(
      strongResumeText,
      ['React'],
      buildJob({ skills: ['React.js'] }),
      buildProfile()
    )
    expect(result.rationale.matchedSkills).toEqual(['React.js'])
    expect(result.rationale.missingSkills).toEqual([])
  })

  it('matches near-synonymous leadership phrasing via the alias table — the real regression case', () => {
    const result = computeMatchScore(
      strongResumeText,
      ['Technical leadership'],
      buildJob({ skills: ['People Leadership'] }),
      buildProfile()
    )
    expect(result.rationale.matchedSkills).toEqual(['People Leadership'])
  })

  it('matches common abbreviation <-> full-name pairs via the alias table (K8s / Kubernetes)', () => {
    const result = computeMatchScore(strongResumeText, ['Kubernetes'], buildJob({ skills: ['K8s'] }), buildProfile())
    expect(result.rationale.matchedSkills).toEqual(['K8s'])
  })

  it('does not let a short skill name false-positive-match as a substring of an unrelated word', () => {
    // "ai" must not match "rails" (which literally contains the substring
    // "ai") just because it's short — only exact match or the alias table
    // should count for names under 3 characters.
    const result = computeMatchScore(strongResumeText, ['ai'], buildJob({ skills: ['Rails'] }), buildProfile())
    expect(result.rationale.matchedSkills).toEqual([])
    expect(result.rationale.missingSkills).toEqual(['Rails'])
  })
})
