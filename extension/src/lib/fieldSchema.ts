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

/** The text profile fields. Résumé / cover letter travel separately as `FillAttachments` (NM-4). */
export type FillableProfileFields = Partial<Record<Exclude<ProfileFieldKey, 'resume' | 'coverLetter'>, string | null>>

/**
 * A file to attach, carried as base64 because chrome.runtime messages are
 * JSON-only (no ArrayBuffer). Built by the background worker, turned back
 * into a `File` by the content script.
 */
export interface AttachmentPayload {
  base64: string
  filename: string
  mimeType: string
}

/** What the content script may put into résumé / cover-letter fields (NM-4). */
export interface FillAttachments {
  resume?: AttachmentPayload
  coverLetterFile?: AttachmentPayload
  /** For forms whose cover-letter field is a textarea / text input. */
  coverLetterText?: string
}
