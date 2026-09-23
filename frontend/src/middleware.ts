import { NextRequest, NextResponse } from 'next/server'

/**
 * Canonical host: www.jobmagnate.com → https://jobmagnate.com (308, path and
 * query kept). www is mapped to this same Cloud Run service
 * (google_cloud_run_domain_mapping.frontend_www) only so it can redirect —
 * serving the app on both hosts would make them separate origins, i.e.
 * separate sign-in sessions (localStorage), separate PWA installs, and split
 * SEO.
 *
 * Reads the Host header rather than request.nextUrl: behind Cloud Run the
 * standalone server's nextUrl host isn't the public domain.
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').toLowerCase()
  if (!host.startsWith('www.')) return NextResponse.next()

  const { pathname, search } = request.nextUrl
  return NextResponse.redirect(`https://${host.slice(4).split(':')[0]}${pathname}${search}`, 308)
}

export const config = {
  // Everything except Next's own static assets — those are only ever
  // requested from a page that has already been redirected.
  matcher: ['/((?!_next/static|_next/image).*)'],
}
