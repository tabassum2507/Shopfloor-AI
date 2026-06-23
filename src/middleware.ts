import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

// ─── Middleware ────────────────────────────────────────────────
//
// Runs on every non-static request.  Two jobs:
//  1. Refresh the Supabase auth token so it never expires mid-session.
//  2. Protect all routes — unauthenticated users → /login.

export async function middleware(request: NextRequest) {
  // Start with a plain pass-through response; may be replaced below.
  let response = NextResponse.next({ request })

  // Build a Supabase client that can read AND write the session cookie
  // on both the request (for subsequent middleware/handlers) and the
  // response (so the refreshed token reaches the browser).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Stamp updated cookies onto the request first so downstream
          // route handlers see the refreshed values within this request.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild the response with the forwarded request cookies, then
          // add each refreshed cookie to the response so it reaches the browser.
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: always use getUser() here, never getSession().
  // getSession() only reads the local cookie without verifying the JWT;
  // getUser() makes a round-trip to the Supabase Auth server to validate it.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthPage   = pathname === '/login' || pathname === '/signup'

  // Unauthenticated visitor on a protected route → send to /login
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated visitor on /login or /signup → send to dashboard
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

// ─── Matcher ──────────────────────────────────────────────────
// Run on every path except Next.js internals, static assets, and favicon.

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
