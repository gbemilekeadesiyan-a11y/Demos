import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Public — no auth, no data beyond a status. Deliberately excluded from
// the auth-gating middleware entirely (see middleware.ts's matcher) rather
// than added to its logged-out allowlist, so this never runs the
// session/cookie-refresh dance a health check has no business depending on.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // head: true — a HEAD-style count query that returns zero rows, just
    // the count in a header. Enough to prove the DB round-trip works
    // without ever touching (or being able to leak) row data.
    const { error } = await createClient().then((supabase) =>
      supabase.from('profiles').select('*', { count: 'exact', head: true })
    )

    if (error) {
      return NextResponse.json(
        { status: 'error', database: 'disconnected', error: error.message, timestamp: new Date().toISOString() },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { status: 'ok', database: 'connected', timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { status: 'error', database: 'disconnected', error: message, timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }
}
