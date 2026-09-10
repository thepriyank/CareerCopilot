# PWA — installable web app

Jobmagnate's frontend is a Progressive Web App: it can be installed to a
phone home screen and launched in a standalone window (no browser
chrome). The mobile-responsive work (bottom tab bar, stacked layouts)
already makes it behave like a native app once installed — the PWA layer
is packaging, not a rewrite.

## What's in it

| File | Role |
|---|---|
| `frontend/src/app/manifest.ts` | Web App Manifest, served at `/manifest.webmanifest`. Name, `start_url` (`/dashboard`), `display: standalone`, colors, icon list. |
| `frontend/public/sw.js` | Hand-rolled service worker. App-shell caching only. |
| `frontend/src/app/offline/page.tsx` | Static fallback the SW serves when a navigation fails offline. |
| `frontend/src/components/pwa/ServiceWorkerRegister.tsx` | Registers `/sw.js` — client-side, **production only** (a SW fighting dev HMR causes stale-asset confusion). Mounted in `app/layout.tsx`. |
| `frontend/src/app/layout.tsx` | `manifest` link, `theme-color`, `apple-mobile-web-app-*` meta, `apple-touch-icon` link, `viewport` with `viewportFit: cover`. |
| `frontend/next.config.mjs` | `headers()` sets `Cache-Control: no-cache` on `/sw.js` so a deployed SW change is picked up immediately. |
| `frontend/public/icons/` | App icons — **placeholder** SVGs today; see that dir's `README.md` for the real-asset drop-in slot. |

## Service worker behavior

It only ever touches **same-origin GET** requests. The backend API is a
different origin (`jobmagnate-backend-*.run.app`), so API and auth traffic
is never seen by the SW — there is no risk of caching a stale authed
response. (Extra `/api/` and `RSC:` header guards cover the
`next.config.mjs` `/api/*` rewrite and App Router RSC payloads.)

| Request | Strategy |
|---|---|
| Navigations (`mode === 'navigate'`) | **Network-first.** Offline → cached copy → `/offline`. |
| `/_next/static/*`, `/icons/*`, `*.css/js/woff2/png/svg/...` | **Cache-first** (content-hashed / stable). |
| Everything else same-origin | Straight to network, no SW involvement. |
| Cross-origin (backend, fonts CDN) | Untouched. |

### Freshness after a deploy

Navigations are network-first, so an online user always gets fresh HTML,
which references Next's content-hashed chunks (immutable — safe to cache
forever). The cache only serves stale content when **offline**.

`CACHE_VERSION` in `sw.js` (`'v1'`) is bumped **only when `sw.js`'s own
logic changes** — not on every app deploy. Bumping it makes the
`activate` handler drop the previous cache.

## Offline scope — what actually works offline

- The app **shell** and any page **previously visited** load from cache.
- Everything data-driven (jobs, matches, résumé, settings) needs the
  network — it all lives on the backend. Offline, those screens show
  their normal "failed to load" state, or `/offline` for a cold
  navigation.

This is deliberate. It is not a full offline app and shouldn't be
described as one.

## Verifying it

Static checks (any environment):

```bash
cd frontend && npm run build && PORT=3100 npx next start &
curl -s http://localhost:3100/manifest.webmanifest | jq .
curl -s -I http://localhost:3100/sw.js | grep -i cache-control   # -> no-cache
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3100/offline   # -> 200
```

Runtime checks need a **real browser** (Chrome DevTools → Application, or
a phone) — automation/embedded browsers stub `serviceWorker.register()`:

- **Chrome desktop**: DevTools → Application → Manifest (no errors,
  icons resolve), → Service Workers (activated, controlling), → an
  "Install" button appears in the address bar.
- **Android Chrome** (against staging): ⋮ menu → "Install app" / "Add to
  Home screen" → launches standalone with the app icon.
- **iOS Safari** (against staging): Share → "Add to Home Screen".
  Note: iOS has **no install prompt** — it's always this manual flow —
  and needs `apple-touch-icon.png` to exist for a clean icon (see
  `public/icons/README.md`).

## Not included (future work)

- **Push notifications** — a separate project: VAPID keys, a backend
  push service, permission UX, and on iOS requires 16.4+ *and* the app
  installed to the home screen.
- **Background sync / offline mutations** — the app is approval-driven
  and server-authoritative; queuing writes offline isn't a fit for MVP.
- **Real brand icons** — placeholder until the logo is designed.
