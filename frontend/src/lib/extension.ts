// The published Assisted Apply extension (live on the Chrome Web Store since
// 2026-09-23). Both values are public, so they're baked in as defaults
// rather than left to per-environment config — env vars still override them,
// e.g. NEXT_PUBLIC_EXTENSION_ID for a locally loaded unpacked build, whose id
// differs from the store one. `||` (not `??`) so an empty value in .env
// falls through to the default instead of hiding the install link.
export const PUBLISHED_EXTENSION_ID = 'gkfhjcfjdpaipbmhjgcjdpldeojimdfi'

export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || PUBLISHED_EXTENSION_ID

export const CHROME_WEBSTORE_URL =
  process.env.NEXT_PUBLIC_CHROME_WEBSTORE_URL ||
  `https://chromewebstore.google.com/detail/jobmagnate-%E2%80%94-assisted-app/${PUBLISHED_EXTENSION_ID}`
