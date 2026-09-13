/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloud Run image (2026-09-08): standalone output bundles only the traced
  // production dependencies into .next/standalone, runnable with a plain
  // `node server.js` — no need to ship node_modules or run `next start` in
  // the container. See frontend/Dockerfile.
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/:path*`,
      },
    ]
  },
  async headers() {
    return [
      {
        // The service worker script must always be revalidated so a
        // deployed change to public/sw.js takes effect immediately.
        // NOTE: `no-store` is deliberately NOT used here — Chrome refuses
        // to register a service worker whose own script is served
        // no-store. `no-cache` (revalidate-before-use) is the correct and
        // allowed directive for a SW script.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
}

export default nextConfig
