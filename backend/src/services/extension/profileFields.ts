import { AppDataSource } from '../../config/dataSource'
import { User } from '../../entities/User'
import { CandidateProfile } from '../../entities/CandidateProfile'
import { GeneratedResumeVersion } from '../../entities/GeneratedResumeVersion'
import { ParsedResume } from '../../entities/ParsedResume'
import { ResumeVersionType } from '../../entities/enums'
import { ExtractedEntities, ContactInfo } from '../../types'

export interface ExtensionProfileFields {
  name: string | null
  email: string
  phone: string | null
  location: string | null
  linkedin: string | null
  website: string | null
  visaStatus: string | null
  noticePeriod: string | null
}

/**
 * The profile fields the extension fills into a form — sourced from the
 * master résumé's contact block when one exists (the same "current résumé
 * data" every other feature treats as canonical — see jobs.routes.ts),
 * falling back to the most recently parsed résumé for a user who hasn't
 * generated a master résumé yet.
 */
export async function buildExtensionProfileFields(userId: string): Promise<ExtensionProfileFields> {
  const userRepo = AppDataSource.getRepository(User)
  const profileRepo = AppDataSource.getRepository(CandidateProfile)
  const resumeRepo = AppDataSource.getRepository(GeneratedResumeVersion)
  const parsedRepo = AppDataSource.getRepository(ParsedResume)

  const [user, profile, masterResume] = await Promise.all([
    userRepo.findOneBy({ id: userId }),
    profileRepo.findOneBy({ userId }),
    resumeRepo.findOne({ where: { userId, type: ResumeVersionType.MASTER }, order: { createdAt: 'DESC' } }),
  ])

  let contact: ContactInfo = (masterResume?.content as unknown as ExtractedEntities | undefined)?.contact ?? {}
  if (!contact.name && !contact.email && !contact.phone) {
    const parsed = await parsedRepo.findOne({ where: { userId }, order: { createdAt: 'DESC' } })
    contact = (parsed?.extractedEntities as unknown as ExtractedEntities | undefined)?.contact ?? {}
  }

  return {
    name: contact.name ?? user?.name ?? null,
    email: contact.email ?? user?.email ?? '',
    phone: contact.phone ?? null,
    location: contact.location ?? null,
    linkedin: contact.linkedin ?? null,
    website: contact.website ?? null,
    visaStatus: profile?.visaStatus ?? null,
    noticePeriod: profile?.noticePeriod ?? null,
  }
}
