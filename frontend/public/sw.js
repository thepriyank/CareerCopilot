/*
 * Jobmagnate service worker — hand-rolled app-shell caching.
 *
 * Scope: registered from /sw.js, so it controls the whole origin.
 * It only ever touches SAME-ORIGIN GET requests. The backend API is a
 * different origin (jobmagnate-backend-*.run.app) so API/auth traffic is
 * never seen here; the extra `/api/` and `RSC` guards below are
 * belt-and-suspenders for the next.config.mjs `/api/*` rewrite and RSC
 * navigation payloads.
 *
 * Freshness after a deploy: navigations are network-first, so an online
 * user always gets fresh HTML, which references Next's content-hashed
 * chunks (immutable — safe to cache forever). The cache only serves stale
 * content when OFFLINE. Bump CACHE_VERSION only when THIS FILE's logic
 * changes, not on every app deploy.
 */
const CACHE_VERSION = 'v1'
const CACHE_NAME = `jobmagnate-shell-${CACHE_VERSION}`

const SHELL = ['/', '/login', '/dashboard', '/offline', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Individually, so one bad entry doesn't fail the whole install.
      Promise.allSettled(SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' }))))
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const STATIC_RE = /\.(?:css|js|mjs|woff2?|ttf|otf|png|svg|jpe?g|webp|avif|gif|ico|webmanifest)$/

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return          // backend API, fonts CDN, etc.
  if (url.pathname.startsWith('/api/')) return             // the next.config rewrite path
  if (request.headers.get('RSC')) return                   // App Router RSC navigation payloads

  // App shell — network-first, fall back to cache then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() =>
          caches.match(request)
            .then((hit) => hit || caches.match('/offline'))
            .then((res) => res || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }))
        )
    )
    return
  }

  // Static, content-hashed / stable assets — cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || STATIC_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {})
            return res
          })
      )
    )
    return
  }

  // Everything else same-origin: straight to network, no SW involvement.
})
