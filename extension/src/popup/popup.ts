// The web app origin the Connect button opens — overridden at build time
// for local dev, see scripts/build.mjs's `--web=` flag and README.
const WEB_APP_URL = (globalThis as { JOBMAGNATE_WEB_APP_URL?: string }).JOBMAGNATE_WEB_APP_URL
  ?? 'https://jobmagnate.com'

const statusEl = document.getElementById('status') as HTMLDivElement
const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement
const fillBtn = document.getElementById('fillBtn') as HTMLButtonElement
const disconnectBtn = document.getElementById('disconnectBtn') as HTMLButtonElement
const resultEl = document.getElementById('result') as HTMLDivElement

interface StatusResponse {
  connected: boolean
  profile?: { email?: string | null }
  remainingFills?: number | null
}

async function refresh(): Promise<void> {
  const status = (await chrome.runtime.sendMessage({ type: 'JOBMAGNATE_GET_STATUS' })) as StatusResponse

  if (!status?.connected) {
    statusEl.textContent = 'Not connected'
    connectBtn.hidden = false
    fillBtn.hidden = true
    disconnectBtn.hidden = true
    return
  }

  const remaining = status.remainingFills === null || status.remainingFills === undefined
    ? 'Unlimited autofills'
    : `${status.remainingFills} autofill${status.remainingFills === 1 ? '' : 's'} left`
  statusEl.textContent = `${status.profile?.email ?? 'Connected'} · ${remaining}`
  connectBtn.hidden = true
  fillBtn.hidden = false
  disconnectBtn.hidden = false
}

connectBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: `${WEB_APP_URL}/extension/connect` })
})

fillBtn.addEventListener('click', async () => {
  fillBtn.disabled = true
  resultEl.hidden = false
  resultEl.textContent = 'Filling…'

  const result = (await chrome.runtime.sendMessage({ type: 'JOBMAGNATE_POPUP_FILL' })) as { ok: boolean; message: string }
  resultEl.textContent = result.message

  fillBtn.disabled = false
  void refresh()
})

disconnectBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'JOBMAGNATE_DISCONNECT' })
  resultEl.hidden = true
  void refresh()
})

void refresh()
