import { getToken, setToken, clearToken, fetchProfile, requestFill, requestFieldMap, fetchArtifact, ApiError } from './api'
import type { ExtensionFillsResponse } from './api'
import type { FieldMappingEntry, FillAttachments, FormFieldSchema } from '../lib/fieldSchema'

// The only piece that holds the token and makes network calls — see
// "Architecture" in docs/assisted_apply_extension_plan.md. Orchestrates:
// inject the content script → extract the form's schema → resolve the
// fill (charges a credit) + the field mapping (cached) in parallel → send
// the combined result back for the content script to actually fill.

/** Stores a token only after confirming the backend actually accepts it — a typo'd or already-revoked token fails immediately instead of silently "connecting." */
export async function connectWithToken(token: string): Promise<{ ok: boolean; message?: string }> {
  await setToken(token)
  try {
    await fetchProfile()
    return { ok: true }
  } catch (err) {
    await clearToken()
    if (err instanceof ApiError && err.status === 401) {
      return { ok: false, message: 'That token is invalid or has been revoked.' }
    }
    return { ok: false, message: err instanceof ApiError ? err.message : 'Could not reach JobMagnate.' }
  }
}

// Token handoff from the web app's /extension/connect page — permitted
// only from origins listed in manifest.json's `externally_connectable`.
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'JOBMAGNATE_CONNECT' && typeof message.token === 'string') {
    ;(async () => {
      sendResponse(await connectWithToken(message.token))
    })()
    return true
  }
  return false
})

/**
 * Fetches only the documents this particular form has a place for (NM-4):
 * the résumé file if a résumé field is a file input, the cover letter as a
 * file or as text depending on that field's type. The server decides *which*
 * artifact (approved-only, best match for the job); a missing one just
 * leaves the field blank — never a reason to fail the whole fill.
 */
export async function gatherAttachments(
  schema: FormFieldSchema[],
  mapping: FieldMappingEntry[],
  fills: Pick<ExtensionFillsResponse, 'job' | 'resume' | 'coverLetter' | 'coverLetterText'>
): Promise<FillAttachments> {
  const typeOf = new Map(schema.map((f) => [f.fieldKey, f.type.toLowerCase()]))
  const fieldTypes = (key: 'resume' | 'coverLetter') =>
    mapping.filter((m) => m.profileKey === key).map((m) => typeOf.get(m.fieldKey) ?? '')

  const jobId = fills.job?.id ?? null
  const attachments: FillAttachments = {}
  const wantsResumeFile = fieldTypes('resume').includes('file') && !!fills.resume
  const coverTypes = fieldTypes('coverLetter')
  const wantsCoverFile = coverTypes.includes('file') && !!fills.coverLetter
  const wantsCoverText = coverTypes.some((t) => t !== 'file') && !!fills.coverLetterText

  // Takes a thunk, not a promise, so a synchronous throw is caught too.
  const safely = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn()
    } catch {
      return null // a document we couldn't fetch is left blank, the rest still fills
    }
  }
  const [resume, coverLetterFile] = await Promise.all([
    wantsResumeFile ? safely(() => fetchArtifact('resume', jobId)) : Promise.resolve(null),
    wantsCoverFile ? safely(() => fetchArtifact('cover-letter', jobId)) : Promise.resolve(null),
  ])
  if (resume) attachments.resume = resume
  if (coverLetterFile) attachments.coverLetterFile = coverLetterFile
  if (wantsCoverText && fills.coverLetterText) attachments.coverLetterText = fills.coverLetterText
  return attachments
}

const RESUME_LABEL: Record<string, string> = {
  TAILORED: 'your tailored résumé',
  MASTER: 'your résumé',
  ORIGINAL: 'your uploaded résumé',
}

/** The popup's one-line summary of a fill, including what got attached (NM-4). */
export function fillSummary(
  result: { filled: number; mappable: number; attached?: ('resume' | 'coverLetter')[] },
  fills: Pick<ExtensionFillsResponse, 'resume' | 'unapprovedTailoredResumeExists'>
): string {
  if (result.mappable === 0) {
    return "Nothing on this form matched your profile — it's probably all screening questions. Review and fill those yourself."
  }
  const parts = [`Filled ${result.filled} of ${result.mappable} matched fields`]
  const docs: string[] = []
  if (result.attached?.includes('resume')) docs.push(RESUME_LABEL[fills.resume?.type ?? ''] ?? 'your résumé')
  if (result.attached?.includes('coverLetter')) docs.push('your cover letter')
  if (docs.length) parts.push(`attached ${docs.join(' and ')}`)
  let message = `${parts.join(', ')} — review before you submit.`
  if (fills.unapprovedTailoredResumeExists) {
    message += ' You have an unapproved tailored résumé for this job — review it in JobMagnate to use it next time.'
  }
  return message
}

interface FillFlowResult {
  ok: boolean
  message: string
  /** Out of free autofills — the popup offers an upgrade (NM-5). */
  upgrade?: boolean
}

export async function runFillFlow(tabId: number): Promise<FillFlowResult> {
  const token = await getToken()
  if (!token) return { ok: false, message: 'Connect the extension to JobMagnate first.' }

  const tab = await chrome.tabs.get(tabId)
  const url = tab.url
  if (!url) return { ok: false, message: "Can't read this tab's URL." }

  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return { ok: false, message: 'This page has no fillable form.' }
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  } catch {
    return { ok: false, message: "JobMagnate can't run on this page (a browser-internal page, or the Chrome Web Store)." }
  }

  const extracted = (await chrome.tabs.sendMessage(tabId, { type: 'JOBMAGNATE_EXTRACT_SCHEMA' })) as
    | { schema: FormFieldSchema[] }
    | undefined
  const schema = extracted?.schema ?? []
  if (schema.length === 0) {
    return { ok: false, message: 'No fillable fields found on this page.' }
  }

  try {
    const [fillsResult, mapResult] = await Promise.all([
      requestFill(url),
      requestFieldMap(hostname, schema),
    ])

    const attachments = await gatherAttachments(schema, mapResult.mapping, fillsResult)

    const fillResponse = (await chrome.tabs.sendMessage(tabId, {
      type: 'JOBMAGNATE_FILL',
      profile: fillsResult.profile,
      mapping: mapResult.mapping,
      attachments,
    })) as { filled: number; mappable: number; attached?: ('resume' | 'coverLetter')[] } | undefined

    return {
      ok: true,
      message: fillSummary({ filled: fillResponse?.filled ?? 0, mappable: fillResponse?.mappable ?? 0, attached: fillResponse?.attached }, fillsResult),
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 402) {
      // NM-5: the moment a free user runs out is the best moment to offer an
      // upgrade — the popup turns `upgrade` into a button to Settings → Plan.
      return {
        ok: false,
        upgrade: true,
        message: "You've used all your free autofills for this month. Get a pass for unlimited autofills.",
      }
    }
    if (err instanceof ApiError && err.status === 403 && err.code === 'PLATFORM_EXCLUDED') {
      return { ok: false, message: 'JobMagnate doesn’t autofill forms on this site yet.' }
    }
    // Only our own ApiError copy is shown; chrome.scripting / DOM errors
    // carry browser-internal detail.
    return { ok: false, message: err instanceof ApiError ? err.message : 'Something went wrong. Reload the page and try again.' }
  }
}

// No chrome.action.onClicked listener: manifest.json sets a default_popup,
// and Chrome only ever fires onClicked when there is NO popup — with one
// set, clicking the toolbar icon always opens it instead. The popup's
// "Fill this form" button (JOBMAGNATE_POPUP_FILL below) is the only trigger.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'JOBMAGNATE_POPUP_FILL') {
    ;(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) {
        sendResponse({ ok: false, message: 'No active tab.' })
        return
      }
      sendResponse(await runFillFlow(tab.id))
    })()
    return true
  }

  if (message?.type === 'JOBMAGNATE_GET_STATUS') {
    ;(async () => {
      const token = await getToken()
      if (!token) {
        sendResponse({ connected: false })
        return
      }
      try {
        const profile = await fetchProfile()
        sendResponse({ connected: true, ...profile })
      } catch {
        sendResponse({ connected: false })
      }
    })()
    return true
  }

  if (message?.type === 'JOBMAGNATE_SET_TOKEN' && typeof message.token === 'string') {
    ;(async () => {
      sendResponse(await connectWithToken(message.token))
    })()
    return true
  }

  if (message?.type === 'JOBMAGNATE_DISCONNECT') {
    ;(async () => {
      await clearToken()
      sendResponse({ ok: true })
    })()
    return true
  }

  return false
})
