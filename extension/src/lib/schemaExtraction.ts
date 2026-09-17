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

/**
 * Finds every `input`/`textarea`/`select`, piercing OPEN shadow roots —
 * plenty of ATS design systems (SmartRecruiters' `spl-input` etc. is the
 * one this was built against) wrap the real native field inside a custom
 * element's shadow DOM, where a plain `querySelectorAll` from the light DOM
 * finds nothing at all. Closed shadow roots are genuinely inaccessible from
 * outside code (`el.shadowRoot` is null for those) — nothing to be done
 * about that case, but it's also the rarer choice since it breaks a11y
 * tooling too, which most design systems care about avoiding.
 */
function collectFillableElements(root: ParentNode): FillableElement[] {
  const found: FillableElement[] = []
  const queue: ParentNode[] = [root]

  while (queue.length > 0) {
    const node = queue.shift() as ParentNode
    for (const el of node.querySelectorAll('input, textarea, select')) {
      found.push(el as FillableElement)
    }
    for (const el of node.querySelectorAll('*')) {
      if (el.shadowRoot) queue.push(el.shadowRoot)
    }
  }

  return found
}

/**
 * Walks up through shadow boundaries from a field that lives inside one
 * (or more, nested) shadow root(s) looking for a hosting custom element
 * that carries an `id` and/or a semantic `label`/`aria-label` attribute —
 * the design-system pattern that leaves the real `<input>` with neither
 * (see SmartRecruiters: `<spl-input id="first-name-input" label="First
 * name">` wraps `<input id="first-name-input">` with no `name`, no
 * `aria-label`). A no-op (both null) for a field that was never inside a
 * shadow root to begin with.
 */
function findShadowHostInfo(el: Element): { id: string | null; label: string | null } {
  let node: Node = el
  let id: string | null = null
  let label: string | null = null

  for (let hops = 0; hops < 6 && (!id || !label); hops++) {
    const root = node.getRootNode()
    if (!(root instanceof ShadowRoot)) break
    const host = root.host
    if (!id && host.id) id = host.id
    if (!label) {
      const hostLabel = host.getAttribute('label') || host.getAttribute('aria-label')
      if (hostLabel?.trim()) label = hostLabel.trim()
    }
    node = host
  }

  return { id, label }
}

function findLabelText(el: HTMLElement, shadowLabel: string | null): string | null {
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

  return shadowLabel
}

/**
 * Pulls every fillable field out of a form (or the whole document) — schema
 * only, never a value, per the plan doc's PII rule. Skips anything without
 * a `name` or `id` (its own, or its shadow host's — there's no stable key
 * to report a mapping back against otherwise) and de-dupes on that key,
 * which is also how radio-button groups (many elements sharing one `name`)
 * end up excluded rather than half-handled.
 */
export function extractFormFields(root: ParentNode = document): ExtractedField[] {
  const elements = collectFillableElements(root)

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

    const shadowHost = findShadowHostInfo(el)
    const fieldKey = el.name || el.id || shadowHost.id
    if (!fieldKey || seenKeys.has(fieldKey)) continue
    seenKeys.add(fieldKey)

    const type = el instanceof HTMLSelectElement ? 'select' : el instanceof HTMLTextAreaElement ? 'textarea' : el.type
    const placeholder = 'placeholder' in el ? (el as HTMLInputElement).placeholder || null : null

    fields.push({
      fieldKey,
      element: el,
      schema: { fieldKey, type, label: findLabelText(el, shadowHost.label), placeholder },
    })
  }

  return fields
}
