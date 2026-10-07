import { extractFormFields } from '../lib/schemaExtraction'
import { setNativeValue, setSelectValue, highlightField, attachFile } from '../lib/domFill'
import type { AttachmentPayload, FieldMappingEntry, FillAttachments, FillableProfileFields } from '../lib/fieldSchema'

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
  attachments?: FillAttachments
}

export interface FillResult {
  filled: number
  mappable: number
  /** Which documents were actually put into the form (NM-4). */
  attached: ('resume' | 'coverLetter')[]
}

function toFile(payload: AttachmentPayload): File {
  const binary = atob(payload.base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], payload.filename, { type: payload.mimeType })
}

/**
 * Puts the résumé / cover letter into one mapped field (NM-4): a file input
 * gets the file via DataTransfer (attachFile); a cover-letter textarea or
 * text input gets the letter's text through the native value setter, so
 * React-controlled ATS forms keep it. Returns whether anything was filled.
 */
function fillDocumentField(
  el: HTMLElement,
  key: 'resume' | 'coverLetter',
  attachments: FillAttachments
): boolean {
  if (el instanceof HTMLInputElement && el.type === 'file') {
    const payload = key === 'resume' ? attachments.resume : attachments.coverLetterFile
    if (!payload) return false
    attachFile(el, toFile(payload))
    return true
  }
  if (key === 'coverLetter' && attachments.coverLetterText && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
    setNativeValue(el, attachments.coverLetterText)
    return true
  }
  return false
}

type IncomingMessage = ExtractSchemaMessage | FillMessage

export function fillForm(
  profile: FillableProfileFields,
  mapping: FieldMappingEntry[],
  attachments: FillAttachments = {}
): FillResult {
  const fields = extractFormFields()
  const byKey = new Map(fields.map((f) => [f.fieldKey, f]))

  let filled = 0
  let mappable = 0
  const attached: FillResult['attached'] = []

  for (const entry of mapping) {
    if (!entry.profileKey) continue
    mappable++

    const field = byKey.get(entry.fieldKey)
    if (!field) continue

    if (entry.profileKey === 'resume' || entry.profileKey === 'coverLetter') {
      if (fillDocumentField(field.element, entry.profileKey, attachments)) {
        filled++
        if (!attached.includes(entry.profileKey)) attached.push(entry.profileKey)
        highlightField(field.element)
      }
      continue
    }

    const value = profile[entry.profileKey]
    if (!value) continue

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

  return { filled, mappable, attached }
}

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  if (message?.type === 'JOBMAGNATE_EXTRACT_SCHEMA') {
    sendResponse({ schema: extractFormFields().map((f) => f.schema) })
    return true
  }

  if (message?.type === 'JOBMAGNATE_FILL') {
    sendResponse(fillForm(message.profile, message.mapping, message.attachments))
    return true
  }

  return false
})
