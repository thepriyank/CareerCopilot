import type { MetadataRoute } from 'next'

/**
 * Web App Manifest — served by Next at /manifest.webmanifest.
 *
 * Icons: the two SVG entries below are PLACEHOLDERS (see
 * public/icons/README.md). When real brand assets are dropped into
 * public/icons/, uncomment the PNG block and delete the SVG entries —
 * that's the whole change. iOS's apple-touch-icon is wired separately in
 * app/layout.tsx and also needs a real PNG.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Jobmagnate — Career Copilot',
    short_name: 'Jobmagnate',
    description: 'The career copilot that shows its work — resume tailoring, job matching, and skill gaps, with every AI edit waiting on your approval.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#ffffff',
    background_color: '#fbfbfc',
    categories: ['productivity', 'business'],
    icons: [
      // ─── PLACEHOLDER (SVG, works for Android/Chrome install) ───
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },

      // ─── REAL ASSETS — uncomment when public/icons/*.png exist ───
      // { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      // { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
