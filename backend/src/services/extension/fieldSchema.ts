/**
 * The fixed vocabulary the generic field-mapping LLM call is allowed to map
 * a form field to — see "Field mapping" in docs/assisted_apply_extension_plan.md.
 * Deliberately closed: the LLM picks from this list or returns null
 * (unmapped), it never invents a new key. `null` matters as much as any
 * real value here — a screening/EEO/"why us" question must be left alone,
 * not guess-filled.
 *
 * Kept in sync by hand with `extension/src/lib/fieldSchema.ts` (the
 * extension workspace has no build-time access to this backend package) —
 * both files carry this same comment pointing at the other.
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

export function isProfileFieldKey(value: unknown): value is ProfileFieldKey {
  return typeof value === 'string' && (PROFILE_FIELD_KEYS as readonly string[]).includes(value)
}

/** One form field's shape — never a value, per the plan doc's PII rule. */
export interface FormFieldSchema {
  /** `name` or `id` from the DOM — whichever the content script found; the stable key a mapping result refers back to. */
  fieldKey: string
  type: string
  label: string | null
  placeholder: string | null
}

export interface FieldMappingEntry {
  fieldKey: string
  profileKey: ProfileFieldKey | null
}
