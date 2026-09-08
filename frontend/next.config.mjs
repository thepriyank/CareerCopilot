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
}

export default nextConfig
