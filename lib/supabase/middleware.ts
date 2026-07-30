import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Matches only /sessions/<uuid> — a specific public session's
  // view/vote page — not any path starting with /sessions (e.g.
  // /sessions/create, an admin-only route that must stay gated).
  const isPublicSessionPath =
    /^\/sessions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      request.nextUrl.pathname
    )

  if (
    !user &&
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/join') &&
    !isPublicSessionPath
  ) {
    // no user, potentially respond by redirecting the user to the login page.
    // '/' is exempted (exact match, not a prefix — every other route stays
    // gated) since it's the public landing page. '/join' is exempted so the
    // join-by-code page itself is reachable without an account (entering a
    // code is what should gate access, not viewing the entry form).
    // Public sessions are exempted: guest voting works via anonymous
    // sign-in (see demos-system-design.md — "Guest voting: Allowed on
    // public sessions"), so unauthenticated visitors there must not be
    // bounced to /login. Everything else under /sessions (e.g.
    // /sessions/create) stays gated.
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}
