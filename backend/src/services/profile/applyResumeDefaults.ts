/**
 * 2026-09-21 product decision: "we ask for resume as the first thing for
 * the user, and also parse it, we should be able to fill the years of
 * experience... from the resume first, then show the user their profile
 * filled with the details, and then they can change something if they want
 * and then save" — rather than asking a cold onboarding-chat question for
 * data the résumé parse already computed
 * (`services/parsing/entityExtractor.ts`'s `totalYearsOfExperience`, judged
 * by the same LLM call from the résumé's own experience date ranges).
 *
 * Called once, right after a résumé finishes parsing (see
 * `routes/resume.routes.ts`'s `POST /upload`) — before onboarding chat ever
 * starts, since résumé upload is always step one. The candidate still
 * reviews and can override this on the onboarding completion screen
 * (`ProfileCompletion.tsx`) or later in Settings; this only ever sets a
 * starting value, never overwrites one that's already there, so a candidate
 * who already answered/edited this is never silently overridden by a later
 * resume re-upload.
 */

import { AppDataSource } from '../../config/dataSource'
import { CandidateProfile } from '../../entities/CandidateProfile'

export async function applyResumeDerivedProfileDefaults(
  userId: string,
  totalYearsOfExperience: number | null
): Promise<void> {
  if (totalYearsOfExperience == null) return

  const profileRepo = AppDataSource.getRepository(CandidateProfile)
  const profile = await profileRepo.findOneBy({ userId })

  if (profile) {
    if (profile.yearsOfExperience != null) return // already set — never clobber
    profile.yearsOfExperience = totalYearsOfExperience
    await profileRepo.save(profile)
    return
  }

  // No profile row yet (résumé upload happens before onboarding chat ever
  // creates one) — create it now with just this field; every other column
  // falls back to the entity's own defaults, same as onboarding's own
  // lazy-create path in profile.routes.ts.
  await profileRepo.save(profileRepo.create({ userId, yearsOfExperience: totalYearsOfExperience }))
}
