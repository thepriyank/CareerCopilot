import { Router, Response, NextFunction } from 'express'
import { AppDataSource } from '../config/dataSource'
import { SkillGapReport } from '../entities/SkillGapReport'
import { MatchResult } from '../entities/MatchResult'
import { CourseRecommendation } from '../entities/CourseRecommendation'
import { GeneratedResumeVersion } from '../entities/GeneratedResumeVersion'
import { ResumeVersionType } from '../entities/enums'
import { requireAuth } from '../middleware/auth'
import { createError } from '../middleware/errorHandler'
import { aggregateSkillGaps } from '../services/skills/aggregateSkillGap'
import { AuthRequest, ExtractedEntities } from '../types'

const router = Router()
router.use(requireAuth)

// GET /api/skill-gaps — the caller's missing skills aggregated across every
// job they've run a skill-gap check on (see services/skills/aggregateSkillGap.ts),
// ranked by how much each one is actually blocking a match, plus which ones
// are already saved as a learning goal.
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const skillGapRepo = AppDataSource.getRepository(SkillGapReport)
    const matchRepo = AppDataSource.getRepository(MatchResult)
    const courseRepo = AppDataSource.getRepository(CourseRecommendation)
    const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)

    const [reports, matches, goals, masterResume] = await Promise.all([
      skillGapRepo.find({ where: { userId } }),
      matchRepo.find({ where: { userId } }),
      courseRepo.find({ where: { userId } }),
      resumeRepo.findOne({ where: { userId, type: ResumeVersionType.MASTER }, order: { createdAt: 'DESC' } }),
    ])

    // Latest match score per job (a job may have been re-scored).
    const matchScoreByJobId = new Map<string, number>()
    for (const m of matches) {
      matchScoreByJobId.set(m.jobId, m.score)
    }

    // Skills the candidate's *current* master resume already lists — a
    // stored SkillGapReport is a snapshot from whenever that job was last
    // checked, so a skill marked "achieved" (or added from a job's own
    // missing-skill chips) since then would otherwise keep showing up here
    // forever. Filtering against the live resume is what actually shrinks
    // the roadmap when the candidate closes a gap.
    const resumeSkillNames = new Set(
      (((masterResume?.content as unknown as ExtractedEntities)?.skills ?? []) as { name?: string }[])
        .map((s) => s.name?.trim().toLowerCase())
        .filter((name): name is string => !!name)
    )

    const gaps = aggregateSkillGaps(
      reports.map((r) => ({
        jobId: r.jobId,
        missingSkills: (r.missingSkills as unknown[])
          .map(String)
          .filter((skill) => !resumeSkillNames.has(skill.trim().toLowerCase())),
      })),
      matchScoreByJobId
    )

    const savedGoals = [...new Set(goals.map((g) => (g.metadata as { skill?: string })?.skill).filter((s): s is string => !!s))]

    res.json({ gaps, savedGoals })
  } catch (err) {
    next(err)
  }
})

// POST /api/skill-gaps/:skill/goal — saves a skill as a learning goal. No
// clean free course-search API exists, so this persists a search-link
// "course" pointed at the skill rather than fabricating a catalog integration
// (see ARCHITECTURE.md's job-source-policy note for the same honesty stance
// applied elsewhere in this app).
router.post('/:skill/goal', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!
    const skill = decodeURIComponent(req.params.skill as string)

    const skillGapRepo = AppDataSource.getRepository(SkillGapReport)
    const reports = await skillGapRepo.find({ where: { userId } })
    const owningReport = reports
      .filter((r) => (r.missingSkills as unknown[]).map(String).includes(skill))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]

    if (!owningReport) {
      throw createError(404, 'NOT_FOUND', 'This skill was not found in any of your skill-gap reports')
    }

    const courseRepo = AppDataSource.getRepository(CourseRecommendation)
    let courseRecommendation = courseRepo.create({
      userId,
      skillGapId: owningReport.id,
      provider: 'search-link',
      title: `Learn ${skill}`,
      url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(skill)}`,
      metadata: { skill },
    })
    courseRecommendation = await courseRepo.save(courseRecommendation)

    res.status(201).json({ courseRecommendation })
  } catch (err) {
    next(err)
  }
})

export default router
