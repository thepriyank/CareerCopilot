import { aggregateSkillGaps } from '../../src/services/skills/aggregateSkillGap'

describe('aggregateSkillGaps', () => {
  it('weighs a skill higher when it recurs on a job with a worse match score', () => {
    const reports = [
      { jobId: 'job-1', missingSkills: ['System design'] }, // matched 20 -> weight 80
      { jobId: 'job-2', missingSkills: ['System design'] }, // matched 90 -> weight 10
      { jobId: 'job-3', missingSkills: ['Go'] }, // matched 50 -> weight 50
    ]
    const scores = new Map([
      ['job-1', 20],
      ['job-2', 90],
      ['job-3', 50],
    ])

    const result = aggregateSkillGaps(reports, scores)

    const systemDesign = result.find((r) => r.skill === 'System design')!
    expect(systemDesign.weight).toBe(45) // (80 + 10) / 2
    expect(systemDesign.frequency).toBe(2)

    const go = result.find((r) => r.skill === 'Go')!
    expect(go.weight).toBe(50)
    expect(go.frequency).toBe(1)
  })

  it('sorts highest weight first, tie-broken by frequency', () => {
    const reports = [
      { jobId: 'job-1', missingSkills: ['A'] },
      { jobId: 'job-2', missingSkills: ['B'] },
    ]
    const scores = new Map([
      ['job-1', 10], // A weight 90
      ['job-2', 80], // B weight 20
    ])
    const result = aggregateSkillGaps(reports, scores)
    expect(result.map((r) => r.skill)).toEqual(['A', 'B'])
  })

  it('defaults to a moderate weight for a job that has not been match-scored yet', () => {
    const reports = [{ jobId: 'job-1', missingSkills: ['Rust'] }]
    const result = aggregateSkillGaps(reports, new Map())
    expect(result[0].weight).toBe(50)
  })

  it('assigns tiers by weight threshold', () => {
    const reports = [
      { jobId: 'job-1', missingSkills: ['Critical'] },
      { jobId: 'job-2', missingSkills: ['High'] },
      { jobId: 'job-3', missingSkills: ['Medium'] },
      { jobId: 'job-4', missingSkills: ['Low'] },
    ]
    const scores = new Map([
      ['job-1', 5], // weight 95
      ['job-2', 35], // weight 65
      ['job-3', 60], // weight 40
      ['job-4', 90], // weight 10
    ])
    const result = aggregateSkillGaps(reports, scores)
    expect(result.find((r) => r.skill === 'Critical')!.tier).toBe('critical')
    expect(result.find((r) => r.skill === 'High')!.tier).toBe('high')
    expect(result.find((r) => r.skill === 'Medium')!.tier).toBe('medium')
    expect(result.find((r) => r.skill === 'Low')!.tier).toBe('low')
  })

  it('handles no reports', () => {
    expect(aggregateSkillGaps([], new Map())).toEqual([])
  })
})
