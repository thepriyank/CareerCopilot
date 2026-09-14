import { getToken, setToken, clearToken, fetchProfile, requestFill, requestFieldMap, ApiError } from './api'
import type { FormFieldSchema } from '../lib/fieldSchema'

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
    return { ok: false, message: err instanceof Error ? err.message : 'Could not reach JobMagnate.' }
  }
}

// Token handoff from the web app's /extension/connect page — permitted
// only from origins listed in manifest.json's `externally_connectable`.
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'JOBMAGNATE_CONNECT' && typeof message.token === 'string') {
    connectWithToken(message.token).then(sendResponse)
    return true
  }
  return false
})

interface FillFlowResult {
  ok: boolean
  message: string
}

async function runFillFlow(tabId: number): Promise<FillFlowResult> {
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

    const fillResponse = (await chrome.tabs.sendMessage(tabId, {
      type: 'JOBMAGNATE_FILL',
      profile: fillsResult.profile,
      mapping: mapResult.mapping,
    })) as { filled: number; mappable: number } | undefined

    const filled = fillResponse?.filled ?? 0
    const mappable = fillResponse?.mappable ?? 0

    if (mappable === 0) {
      return { ok: true, message: "Nothing on this form matched your profile — it's probably all screening questions. Review and fill those yourself." }
    }
    return { ok: true, message: `Filled ${filled} of ${mappable} matched fields — review before you submit.` }
  } catch (err) {
    if (err instanceof ApiError && err.status === 402) {
      return { ok: false, message: "You've used all your autofills for this period." }
    }
    if (err instanceof ApiError && err.status === 403 && err.code === 'PLATFORM_EXCLUDED') {
      return { ok: false, message: 'JobMagnate doesn’t autofill forms on this site yet.' }
    }
    return { ok: false, message: err instanceof Error ? err.message : 'Something went wrong.' }
  }
}

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) void runFillFlow(tab.id)
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'JOBMAGNATE_POPUP_FILL') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (!tab?.id) {
        sendResponse({ ok: false, message: 'No active tab.' })
        return
      }
      sendResponse(await runFillFlow(tab.id))
    })
    return true
  }

  if (message?.type === 'JOBMAGNATE_GET_STATUS') {
    getToken().then(async (token) => {
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
    })
    return true
  }

  if (message?.type === 'JOBMAGNATE_SET_TOKEN' && typeof message.token === 'string') {
    connectWithToken(message.token).then(sendResponse)
    return true
  }

  if (message?.type === 'JOBMAGNATE_DISCONNECT') {
    clearToken().then(() => sendResponse({ ok: true }))
    return true
  }

  return false
})
