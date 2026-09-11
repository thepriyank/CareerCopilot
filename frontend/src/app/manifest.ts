import type { MetadataRoute } from 'next'

/**
 * Web App Manifest — served by Next at /manifest.webmanifest.
 *
 * Icons: the real JobMagnate mark (green "J" interlocked with a black "M" —
 * part of the shared NowMagnate/JobMagnate/YouMagnate "Upright interlock"
 * system), sourced from the Claude Design canvas and processed locally —
 * see public/icons/README.md for exact colors and provenance. iOS's
 * apple-touch-icon is wired separately in app/layout.tsx.
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
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
