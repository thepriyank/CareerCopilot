/**
 * Whether a request's `Origin` header should be allowed through CORS.
 *
 * Split out from `index.ts`'s `cors()` call (2026-09-14) because the
 * Assisted Apply extension's background service worker calls this API
 * directly, and its requests carry `Origin: chrome-extension://<id>` — not
 * the frontend's own origin `CORS_ORIGIN` is configured with. A fixed
 * extension id isn't available yet (unpublished, loaded unpacked — see
 * `extension/README.md`), and even once it is, hardcoding one id here would
 * break the moment the extension is loaded unpacked for local dev on a
 * different machine. `chrome-extension://` origins are set by the browser
 * from the extension's own manifest — a website cannot spoof one — and
 * actual access is still gated by the extension-token `Authorization`
 * header this relaxation has no effect on, so allowing the whole scheme
 * here is not a meaningfully wider door than allowing one fixed id would be.
 */
export function isAllowedOrigin(origin: string | undefined, configuredOrigins: string[]): boolean {
  // No Origin header — server-to-server, curl, health checks. Not a browser
  // request, so no CORS decision applies.
  if (!origin) return true
  if (origin.startsWith('chrome-extension://')) return true
  return configuredOrigins.includes(origin)
}
