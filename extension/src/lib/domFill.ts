/**
 * React-controlled inputs ignore naive `el.value = x` — it updates the DOM
 * but not React's internal state, so the value silently reverts. The fix is
 * calling the native property setter directly (bypassing whatever
 * framework has wrapped `value`) and then dispatching the events the
 * framework's own listeners expect. See "Two implementation details" in
 * docs/assisted_apply_extension_plan.md — this is the single most common
 * reason naive autofill appears to work and doesn't.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (setter) {
    setter.call(el, value)
  } else {
    el.value = value
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Exact `value` match first, then a case-insensitive label match — most ATS `<select>`s use human labels as the visible text but an internal id/code as the value. */
export function setSelectValue(el: HTMLSelectElement, value: string): boolean {
  const options = Array.from(el.options)
  const match =
    options.find((o) => o.value === value) ??
    options.find((o) => o.textContent?.trim().toLowerCase() === value.toLowerCase())

  if (!match) return false

  el.value = match.value
  el.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

/**
 * Attaching a file requires constructing a `DataTransfer`, adding the
 * `File`, and assigning `input.files` — direct assignment to `.files` is
 * not permitted otherwise. Not called by v1's fill flow yet (résumé/cover-
 * letter attachment is Phase 2 — see README); kept here, documented and
 * ready, since it's exactly the trick Phase 2 will need and is easy to get
 * subtly wrong.
 */
export function attachFile(el: HTMLInputElement, file: File): void {
  const dataTransfer = new DataTransfer()
  dataTransfer.items.add(file)
  el.files = dataTransfer.files
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

/** A brief, self-reverting outline so the candidate can see exactly what changed — never permanent, never blocks review. */
export function highlightField(el: HTMLElement, durationMs = 2000): void {
  const original = el.style.outline
  el.style.outline = '2px solid #22c55e'
  setTimeout(() => {
    el.style.outline = original
  }, durationMs)
}
