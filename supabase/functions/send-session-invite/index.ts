// Edge Function: sends a "vote without an account" invite email for one
// voting session. Unlike notify-events (deployed --no-verify-jwt, driven by
// DB triggers with no user session), this is called directly from the app
// by an admin clicking a button, so it's deployed WITH JWT verification —
// the platform rejects unauthenticated calls before this code runs — and
// everything inside runs as the caller (via their forwarded JWT), not the
// service role, so RLS is the real enforcement boundary here just like the
// rest of the app.
//
// Deploy with `supabase functions deploy send-session-invite` and the same
// RESEND_API_KEY / RESEND_FROM_EMAIL secrets notify-events already uses.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'dēmos <onboarding@resend.dev>'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function generateCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ success: false, error: 'Not authenticated' }, 401)
  }

  let body: { sessionId?: string; email?: string; origin?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400)
  }

  const { sessionId, email, origin } = body

  if (!sessionId || !email || !origin || !EMAIL_RE.test(email)) {
    return jsonResponse({ success: false, error: 'Missing or invalid sessionId, email, or origin' }, 400)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return jsonResponse({ success: false, error: 'Not authenticated' }, 401)
  }

  const { data: session, error: sessionError } = await supabase
    .from('voting_sessions')
    .select('id, title, workspace_id, who_can_vote, allow_anonymous_vote')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return jsonResponse({ success: false, error: 'Session not found' }, 404)
  }

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: session.workspace_id,
  })

  if (!isAdmin) {
    return jsonResponse({ success: false, error: 'Only workspace admins can send voting invites' }, 403)
  }

  const { data: workspace } = await supabase.from('workspaces').select('type').eq('id', session.workspace_id).single()

  if (
    workspace?.type !== 'ff' ||
    session.who_can_vote !== 'public_link' ||
    session.allow_anonymous_vote !== true
  ) {
    return jsonResponse(
      {
        success: false,
        error:
          'Voting invites are only available for F&F sessions set to public link with anonymous voting enabled',
      },
      400
    )
  }

  const { data: existingInvite } = await supabase
    .from('invites')
    .select('code')
    .eq('session_id', sessionId)
    .limit(1)
    .maybeSingle()

  let code = existingInvite?.code ?? null

  if (!code) {
    code = generateCode()

    const { error: insertError } = await supabase.from('invites').insert({
      session_id: sessionId,
      code,
      created_by: user.id,
    })

    if (insertError) {
      return jsonResponse({ success: false, error: insertError.message }, 500)
    }
  }

  const voteLink = `${origin}/sessions/vote?code=${code}`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: `You're invited to vote: ${session.title}`,
        text: `You've been invited to vote on "${session.title}".\n\nVote without an account: ${voteLink}\n\nOr enter this code at ${origin}/sessions/vote: ${code}`,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('Resend request failed:', response.status, detail)
      return jsonResponse({ success: false, error: 'Failed to send email' }, 502)
    }
  } catch (err) {
    console.error('Resend request threw:', err)
    return jsonResponse({ success: false, error: 'Failed to send email' }, 502)
  }

  return jsonResponse({ success: true })
})
