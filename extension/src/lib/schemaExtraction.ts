import type { FormFieldSchema } from './fieldSchema'

// v1 fills plain text-ish inputs, textareas and single selects — radio
// groups and checkboxes are skipped entirely (safety-first: nothing in the
// mapping vocabulary needs them, and a shared `name` across a radio group
// would break the one-fieldKey-per-element assumption below).
const SUPPORTED_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'search', 'number'])

export type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

export interface ExtractedField {
  fieldKey: string
  element: FillableElement
  schema: FormFieldSchema
}

function isHiddenElement(el: Element): boolean {
  if (el instanceof HTMLInputElement && el.type === 'hidden') return true
  const style = window.getComputedStyle(el)
  return style.display === 'none' || style.visibility === 'hidden'
}

/** `CSS.escape` isn't implemented by every DOM environment (notably jsdom, used in tests) — a minimal manual fallback covers the characters that would otherwise break the selector. */
function escapeForSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

function findLabelText(el: HTMLElement): string | null {
  if (el.id) {
    const forLabel = document.querySelector(`label[for="${escapeForSelector(el.id)}"]`)
    const text = forLabel?.textContent?.trim()
    if (text) return text
  }

  const parentLabel = el.closest('label')
  const wrappedText = parentLabel?.textContent?.trim()
  if (wrappedText) return wrappedText

  const ariaLabel = el.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(' ')
    if (text) return text
  }

  return null
}

/**
 * Pulls every fillable field out of a form (or the whole document) — schema
 * only, never a value, per the plan doc's PII rule. Skips anything without
 * a `name` or `id` (there's no stable key to report a mapping back
 * against) and de-dupes on that key, which is also how radio-button groups
 * (many elements sharing one `name`) end up excluded rather than half-handled.
 */
export function extractFormFields(root: ParentNode = document): ExtractedField[] {
  const elements = Array.from(root.querySelectorAll('input, textarea, select')) as (
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
  )[]

  const fields: ExtractedField[] = []
  const seenKeys = new Set<string>()

  for (const el of elements) {
    if (el instanceof HTMLInputElement) {
      if (el.type !== 'file' && !SUPPORTED_INPUT_TYPES.has(el.type)) continue
      if (el.disabled) continue
    } else if ('disabled' in el && el.disabled) {
      continue
    }
    if (isHiddenElement(el)) continue

    const fieldKey = el.name || el.id
    if (!fieldKey || seenKeys.has(fieldKey)) continue
    seenKeys.add(fieldKey)

    const type = el instanceof HTMLSelectElement ? 'select' : el instanceof HTMLTextAreaElement ? 'textarea' : el.type
    const placeholder = 'placeholder' in el ? (el as HTMLInputElement).placeholder || null : null

    fields.push({
      fieldKey,
      element: el,
      schema: { fieldKey, type, label: findLabelText(el), placeholder },
    })
  }

  return fields
}
