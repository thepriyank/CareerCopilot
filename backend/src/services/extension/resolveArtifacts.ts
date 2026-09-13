import { AppDataSource } from '../../config/dataSource'
import { GeneratedResumeVersion } from '../../entities/GeneratedResumeVersion'
import { GeneratedCoverLetter } from '../../entities/GeneratedCoverLetter'
import { ResumeFile } from '../../entities/ResumeFile'
import { ArtifactStatus, ResumeVersionType } from '../../entities/enums'

export interface ResolvedResume {
  type: 'TAILORED' | 'MASTER' | 'ORIGINAL'
  id: string
  // Points at the existing (session-JWT-authed) download route. Phase 2
  // needs to teach these routes to also accept an extension token — or add
  // a dedicated proxy — before the extension can actually fetch bytes;
  // resolving *which* artifact to use is this phase's job, not delivery.
  downloadUrl: string
}

export interface ResolvedArtifacts {
  resume: ResolvedResume | null
  // A TAILORED resume exists for this job but isn't approved yet — the
  // extension should nudge the user back to JobMagnate to review it rather
  // than silently falling back to the master, per the plan doc.
  unapprovedTailoredResumeExists: boolean
  coverLetter: { id: string; downloadUrl: string } | null
}

/**
 * The best résumé + cover letter the user already has for a job — never
 * blindly the master résumé, and an artifact must be `APPROVED` to ever be
 * returned here (a DRAFT/IN_REVIEW artifact reaching a real application
 * would route around the F6 human-approval workflow). See "Which résumé and
 * cover letter get used" in docs/assisted_apply_extension_plan.md.
 *
 * `jobId` is a UserJob id, or null when job identification failed — résumé
 * resolution still runs in that case (master/original tiers don't need a
 * job); only the tailored-résumé and cover-letter tiers do.
 */
export async function resolveArtifactsForJob(userId: string, jobId: string | null): Promise<ResolvedArtifacts> {
  const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
  const coverLetterRepo = AppDataSource.getRepository(GeneratedCoverLetter)
  const resumeFileRepo = AppDataSource.getRepository(ResumeFile)

  let unapprovedTailoredResumeExists = false
  let resume: ResolvedResume | null = null

  if (jobId) {
    const tailored = await resumeRepo.findOne({
      where: { userId, jobId, type: ResumeVersionType.TAILORED },
      order: { createdAt: 'DESC' },
    })
    if (tailored) {
      if (tailored.status === ArtifactStatus.APPROVED) {
        resume = { type: 'TAILORED', id: tailored.id, downloadUrl: `/api/jobs/${jobId}/tailor/pdf` }
      } else {
        unapprovedTailoredResumeExists = true
      }
    }
  }

  if (!resume) {
    const master = await resumeRepo.findOne({
      where: { userId, type: ResumeVersionType.MASTER, status: ArtifactStatus.APPROVED },
      order: { createdAt: 'DESC' },
    })
    if (master) {
      resume = { type: 'MASTER', id: master.id, downloadUrl: `/api/resume/master/${master.id}/pdf` }
    }
  }

  if (!resume) {
    const original = await resumeFileRepo.findOne({ where: { userId }, order: { uploadedAt: 'DESC' } })
    if (original) {
      resume = { type: 'ORIGINAL', id: original.id, downloadUrl: `/api/resumes/file/${original.id}` }
    }
  }

  let coverLetter: { id: string; downloadUrl: string } | null = null
  if (jobId) {
    const letter = await coverLetterRepo.findOne({
      where: { userId, jobId, status: ArtifactStatus.APPROVED },
      order: { createdAt: 'DESC' },
    })
    if (letter) coverLetter = { id: letter.id, downloadUrl: `/api/jobs/${jobId}/cover-letter/pdf` }
  }

  return { resume, unapprovedTailoredResumeExists, coverLetter }
}
