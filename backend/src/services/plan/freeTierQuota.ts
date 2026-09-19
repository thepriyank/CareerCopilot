import { MoreThanOrEqual } from 'typeorm'
import { AppDataSource } from '../../config/dataSource'
import { GeneratedResumeVersion } from '../../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../entities/GeneratedCoverLetter'
import { ResumeVersionType } from '../../entities/enums'

/**
 * Free-tier monthly caps on the two paid-when-not-trialing artifacts —
 * tailored résumés and cover letters (see docs/monetization_plan.md's
 * tiering table). Same rolling-window-from-signup shape as the extension's
 * autofill quota (services/extension/quota.ts), via the shared
 * currentWindowStart() in resolveEffectivePlan.ts. A PREMIUM user (trial or
 * paid — see resolveEffectivePlan()) is never checked against these at all.
 */
export const FREE_MONTHLY_TAILOR_LIMIT = 3
export const FREE_MONTHLY_COVER_LETTER_LIMIT = 3

export async function countTailoredResumesInWindow(userId: string, windowStart: Date): Promise<number> {
  const repo = AppDataSource.getRepository(GeneratedResumeVersion)
  return repo.count({ where: { userId, type: ResumeVersionType.TAILORED, createdAt: MoreThanOrEqual(windowStart) } })
}

export async function countCoverLettersInWindow(userId: string, windowStart: Date): Promise<number> {
  const repo = AppDataSource.getRepository(GeneratedCoverLetter)
  return repo.count({ where: { userId, createdAt: MoreThanOrEqual(windowStart) } })
}
