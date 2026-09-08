import { Router, Response, NextFunction } from 'express'
import { AppDataSource } from '../config/dataSource'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../entities/GeneratedCoverLetter'
import { MatchResult } from '../entities/MatchResult'
import { ApprovalRecord } from '../entities/ApprovalRecord'
import { SkillGapReport } from '../entities/SkillGapReport'
import { listJobViews } from '../services/jobs/jobView'
import { LinkedInReviewReport } from '../entities/LinkedInReviewReport'
import { ArtifactStatus, ArtifactType, ResumeVersionType } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { aggregateSkillGaps } from '../services/skills/aggregateSkillGap'
import { AuthRequest } from '../types'

const router = Router()
router.use(requireAuth)

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

interface ActivityEntry {
  description: string
  at: Date
}

// GET /api/dashboard — a single read-only rollup so the dashboard doesn't
// need N client-side round trips. Everything here is derived from data
// other phases already persist — no new entity.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!

    const [
      resumes,
      coverLetters,
      matches,
      approvalRecords,
      skillGapReports,
      jobs,
      linkedInReport,
    ] = await Promise.all([
      AppDataSource.getRepository(GeneratedResumeVersion).find({ where: { userId } }),
      AppDataSource.getRepository(GeneratedCoverLetter).find({ where: { userId } }),
      AppDataSource.getRepository(MatchResult).find({ where: { userId } }),
      AppDataSource.getRepository(ApprovalRecord).find({ where: { userId } }),
      AppDataSource.getRepository(SkillGapReport).find({ where: { userId } }),
      listJobViews(userId),
      AppDataSource.getRepository(LinkedInReviewReport).findOne({ where: { userId }, order: { createdAt: 'DESC' } }),
    ])

    const jobById = new Map(jobs.map((j) => [j.id, j]))

    // Master resume summary
    const masterResume = resumes
      .filter((r) => r.type === ResumeVersionType.MASTER)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]

    // Matches this week
    const weekAgo = Date.now() - WEEK_MS
    const matchesThisWeek = matches.filter((m) => m.createdAt.getTime() >= weekAgo).length

    // Pending approval + approval rate
    const nonApproved = [...resumes, ...coverLetters].filter((a) => a.status !== ArtifactStatus.APPROVED)
    const reviewedCount = nonApproved.filter((a) => a.status === ArtifactStatus.IN_REVIEW).length
    const decided = approvalRecords.filter(
      (r) => r.status === ArtifactStatus.APPROVED || r.status === ArtifactStatus.REJECTED
    )
    const approvedDecisions = decided.filter((r) => r.status === ArtifactStatus.APPROVED).length
    const approvalRate = decided.length > 0 ? Math.round((approvedDecisions / decided.length) * 100) : null

    // Top matches
    const topMatches = [...matches]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((m) => {
        const job = jobById.get(m.jobId)
        return {
          jobId: m.jobId,
          title: job?.title ?? 'Unknown role',
          company: job?.company ?? null,
          location: job?.location ?? null,
          isRemote: job?.isRemote ?? null,
          score: m.score,
          matchedSkills: (m.rationale as { matchedSkills?: string[] })?.matchedSkills ?? [],
          missingSkills: (m.rationale as { missingSkills?: string[] })?.missingSkills ?? [],
        }
      })

    // Top skill gap (same aggregation as the roadmap page)
    const matchScoreByJobId = new Map(matches.map((m) => [m.jobId, m.score]))
    const gaps = aggregateSkillGaps(
      skillGapReports.map((r) => ({ jobId: r.jobId, missingSkills: r.missingSkills })),
      matchScoreByJobId
    )
    const topSkillGap = gaps[0] ?? null

    // Recent activity — createdAt marks generation events (avoids duplicating
    // an approval decision, which is already covered by ApprovalRecord below).
    const activityEntries: ActivityEntry[] = [
      ...resumes.map((r) => ({
        description: `AI generated · ${jobById.get(r.jobId ?? '')?.title ?? (r.type === ResumeVersionType.MASTER ? 'Master resume' : 'Tailored resume')}`,
        at: r.createdAt,
      })),
      ...coverLetters.map((c) => ({
        description: `AI generated · ${jobById.get(c.jobId)?.title ?? 'Cover letter'} · Cover letter`,
        at: c.createdAt,
      })),
      ...matches.map((m) => ({
        description: `Matched · ${jobById.get(m.jobId)?.title ?? 'a job'} · ${m.score} score`,
        at: m.createdAt,
      })),
      ...approvalRecords.map((r) => ({
        description: `You ${r.status === ArtifactStatus.APPROVED ? 'approved' : 'rejected'} · ${r.artifactType === ArtifactType.RESUME_VERSION ? 'Resume' : 'Cover letter'}`,
        at: r.timestamp,
      })),
    ]

    const activity = activityEntries
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8)
      .map((entry) => ({ description: entry.description, at: entry.at.toISOString() }))

    res.json({
      masterResume: masterResume ? { status: masterResume.status, updatedAt: masterResume.updatedAt } : null,
      matchesThisWeek,
      pendingApprovalCount: nonApproved.length,
      reviewedCount,
      approvalRate,
      topMatches,
      recentActivity: activity,
      topSkillGap,
      linkedIn: linkedInReport
        ? {
            overallScore: linkedInReport.overallScore,
            headlineRewrite:
              (linkedInReport.suggestions as { headlineRewrites?: { text: string }[] })?.headlineRewrites?.[0]?.text ??
              null,
          }
        : null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
