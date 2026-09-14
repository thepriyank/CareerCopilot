import { extractFormFields } from '../lib/schemaExtraction'
import { setNativeValue, setSelectValue, highlightField } from '../lib/domFill'
import type { FieldMappingEntry, FillableProfileFields } from '../lib/fieldSchema'

// The only piece that touches the page's DOM. Holds no token, makes no
// network calls — everything it knows comes in via a message from the
// background worker. See "Architecture" in docs/assisted_apply_extension_plan.md.

interface ExtractSchemaMessage {
  type: 'JOBMAGNATE_EXTRACT_SCHEMA'
}

interface FillMessage {
  type: 'JOBMAGNATE_FILL'
  profile: FillableProfileFields
  mapping: FieldMappingEntry[]
}

type IncomingMessage = ExtractSchemaMessage | FillMessage

export function fillForm(profile: FillableProfileFields, mapping: FieldMappingEntry[]): { filled: number; mappable: number } {
  const fields = extractFormFields()
  const byKey = new Map(fields.map((f) => [f.fieldKey, f]))

  let filled = 0
  let mappable = 0

  for (const entry of mapping) {
    if (!entry.profileKey || entry.profileKey === 'resume' || entry.profileKey === 'coverLetter') continue
    mappable++

    const field = byKey.get(entry.fieldKey)
    const value = profile[entry.profileKey]
    if (!field || !value) continue

    if (field.element instanceof HTMLSelectElement) {
      if (setSelectValue(field.element, value)) {
        filled++
        highlightField(field.element)
      }
    } else {
      setNativeValue(field.element, value)
      filled++
      highlightField(field.element)
    }
  }

  return { filled, mappable }
}

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  if (message?.type === 'JOBMAGNATE_EXTRACT_SCHEMA') {
    sendResponse({ schema: extractFormFields().map((f) => f.schema) })
    return true
  }

  if (message?.type === 'JOBMAGNATE_FILL') {
    sendResponse(fillForm(message.profile, message.mapping))
    return true
  }

  return false
})
