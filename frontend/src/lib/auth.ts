const TOKEN_KEY = 'copilot_token'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Reads the JWT's `exp` without verifying it (the backend does that on every
 * request). Returns null if the token isn't a readable JWT.
 */
function tokenExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * True when a non-expired session token is stored. An expired or unreadable
 * token is cleared on the spot — otherwise the "signed-in users skip the
 * guest pages" redirect (SignedInRedirect) would bounce an expired session
 * between /dashboard and /login forever.
 */
export function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false
  const exp = tokenExpiryMs(token)
  if (exp === null || exp <= Date.now()) {
    clearToken()
    return false
  }
  return true
}

/**
 * The same check as isAuthenticated(), as a self-contained inline script for
 * the landing page: it runs while the HTML is still parsing, so a signed-in
 * visitor is sent to /dashboard before the guest page ever paints. Keep it
 * dependency-free and in sync with TOKEN_KEY / tokenExpiryMs above.
 */
export const SIGNED_IN_REDIRECT_SCRIPT = `(function(){try{var t=localStorage.getItem('${TOKEN_KEY}');if(!t)return;var p=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(typeof p.exp==='number'&&p.exp*1000>Date.now()){location.replace('/dashboard')}else{localStorage.removeItem('${TOKEN_KEY}')}}catch(e){}})()`
