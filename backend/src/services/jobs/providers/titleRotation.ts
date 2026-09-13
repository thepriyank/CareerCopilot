/**
 * Date-based rotation for title-search aggregators with a tight per-call
 * quota (JSearch: ~200 calls/month, one call per title — see jsearch.ts).
 *
 * 2026-09-09 root cause: jsearch.ts queried a *static* `.slice(0, 3)` of
 * `target-job-titles.json`'s 13 titles, forever — the same 3 ("Software
 * Engineer", "Frontend Engineer", "Backend Engineer") every single run.
 * The other 10 categories (AI Engineer, Data Engineer, Platform Engineer,
 * DevOps Engineer, QA Engineer, Staff/Lead Engineer, Engineering Manager,
 * ...) were never searched via JSearch at all, not once — not a quota
 * problem so much as a coverage problem: JSearch is the one source that
 * already returns clean, well-targeted results (confirmed live — all 40
 * migrated `jsearch` listings were genuinely relevant), and we were only
 * using it for 3 of the 13 roles we actually want.
 *
 * This rotates the query window by day, so every title gets queried on a
 * predictable cadence without any persisted state — just a function of
 * today's date. No coordination needed between discovery runs; the same
 * date always produces the same window.
 */

export function rotateTitles(titles: string[], windowSize: number, date: Date = new Date()): string[] {
  if (titles.length === 0 || windowSize <= 0) return []
  if (windowSize >= titles.length) return titles

  // Days since the Unix epoch (UTC) — stable across a run regardless of
  // time-of-day, so the same calendar day always yields the same window.
  // Advances by `windowSize` per day (not by 1) so consecutive days give
  // genuinely non-overlapping batches, covering the full list in
  // ceil(titles.length / windowSize) days rather than titles.length days.
  const daysSinceEpoch = Math.floor(date.getTime() / 86_400_000)
  const start = (daysSinceEpoch * windowSize) % titles.length

  const out: string[] = []
  for (let i = 0; i < windowSize; i++) {
    out.push(titles[(start + i) % titles.length])
  }
  return out
}
