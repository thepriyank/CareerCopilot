import { rotateTitles } from '../../src/services/jobs/providers/titleRotation'

const TITLES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'] // 13, matching target-job-titles.json's real count

describe('rotateTitles', () => {
  it('returns the full list unchanged when the window covers everything', () => {
    expect(rotateTitles(['A', 'B', 'C'], 6)).toEqual(['A', 'B', 'C'])
    expect(rotateTitles(['A', 'B', 'C'], 3)).toEqual(['A', 'B', 'C'])
  })

  it('returns an empty array for an empty title list or a non-positive window', () => {
    expect(rotateTitles([], 6)).toEqual([])
    expect(rotateTitles(TITLES, 0)).toEqual([])
    expect(rotateTitles(TITLES, -1)).toEqual([])
  })

  it('selects a different, wrapping window on consecutive days — not a static first-N slice', () => {
    const day0 = new Date('2026-01-01T00:00:00Z') // arbitrary fixed reference days-since-epoch
    const day1 = new Date('2026-01-02T00:00:00Z')
    const day2 = new Date('2026-01-03T00:00:00Z')

    const w0 = rotateTitles(TITLES, 6, day0)
    const w1 = rotateTitles(TITLES, 6, day1)
    const w2 = rotateTitles(TITLES, 6, day2)

    expect(w0).toHaveLength(6)
    expect(w1).toHaveLength(6)
    expect(w2).not.toEqual(w0) // the whole point of the fix — this used to always be the same 3

    // Full coverage: every title appears in at least one of a few
    // consecutive days' windows (ceil(13/6) = 3 days for full coverage).
    const seen = new Set([...w0, ...w1, ...w2])
    expect(seen.size).toBe(TITLES.length)
  })

  it('is deterministic for the same date (no hidden state/randomness)', () => {
    const date = new Date('2026-03-15T12:00:00Z')
    expect(rotateTitles(TITLES, 6, date)).toEqual(rotateTitles(TITLES, 6, date))
  })

  it('wraps around the end of the list correctly', () => {
    // Pick a date whose days-since-epoch mod length lands near the end of
    // the list, forcing a window smaller than the list to wrap back to
    // the start. (A window >= length short-circuits to the list as-is —
    // see the "full window unchanged" test above — so this needs
    // windowSize < titles.length to actually exercise wrapping.)
    const titles = ['A', 'B', 'C', 'D']
    // day 2 of a 4-item list starts at index 2 -> a window of 3 wraps: [C, D, A]
    const daysSinceEpoch = 2
    const date = new Date(daysSinceEpoch * 86_400_000)
    expect(rotateTitles(titles, 3, date)).toEqual(['C', 'D', 'A'])
  })
})
