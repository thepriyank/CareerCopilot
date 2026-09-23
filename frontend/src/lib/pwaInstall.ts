/**
 * Captures Chrome/Edge/Samsung Internet's `beforeinstallprompt` so the app
 * can offer "Install" on its own terms.
 *
 * Why this exists: without it, installing depended entirely on the browser's
 * built-in mini-infobar, which Chrome shows once per origin and then
 * suppresses for ~3 months after a dismissal (or forever once installed from
 * that origin). That's why staging (a fresh origin) offered "Install" on a
 * phone while jobmagnate.com — identical manifest and service worker — did
 * not. `preventDefault()` below also keeps that one-off infobar from firing
 * so our own banner is the single, consistent entry point.
 *
 * The event fires early (often before React hydrates), so the listener is
 * attached at module load — this module is imported by ServiceWorkerRegister,
 * which the root layout always mounts.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

/** Subscribe to "installability changed"; returns an unsubscribe fn. */
export function onInstallAvailabilityChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** True when the browser has handed us a native install prompt to show. */
export function canPromptInstall(): boolean {
  return deferred !== null
}

/** Shows the native install dialog. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const evt = deferred
  deferred = null // a prompt event can only be used once
  notify()
  await evt.prompt()
  const { outcome } = await evt.userChoice
  return outcome === 'accepted'
}

/** Already running as an installed app (home-screen launch). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * iOS Safari never fires beforeinstallprompt — installing is a manual
 * Share → "Add to Home Screen", so we can only explain it.
 */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return iOS && !otherBrowser
}
