/**
 * Kept in sync BY HAND with `backend/src/services/extension/fieldSchema.ts`
 * — this workspace has no build-time access to the backend package. Both
 * files carry this same comment pointing at the other. See "Field mapping"
 * in docs/assisted_apply_extension_plan.md.
 */
export const PROFILE_FIELD_KEYS = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'location',
  'linkedin',
  'website',
  'visaStatus',
  'noticePeriod',
  'resume',
  'coverLetter',
] as const

export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number]

/** One form field's shape — never a value, per the plan doc's PII rule. */
export interface FormFieldSchema {
  fieldKey: string
  type: string
  label: string | null
  placeholder: string | null
}

export interface FieldMappingEntry {
  fieldKey: string
  profileKey: ProfileFieldKey | null
}

/** The subset of profile fields v1 actually fills — file fields (resume/coverLetter) are Phase 2, see README. */
export type FillableProfileFields = Partial<Record<Exclude<ProfileFieldKey, 'resume' | 'coverLetter'>, string | null>>
