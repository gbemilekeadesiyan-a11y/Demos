// Edge Function: turns a database event into in-app Notification rows plus
// transactional email via Resend. See demos-system-design.md § 8.4 —
// Supabase's built-in auth email is capped at 2/hour and scoped to its own
// auth flows, so it can't carry these; Resend is the documented substitute
// (https://resend.com/supabase).
//
// Invoked by the triggers in supabase/migrations/009_notifications.sql
// (trigger_notify_events, via pg_net) for two events:
//   - voting_sessions.status changing to 'open' or 'results_released'
//   - a workspace-scoped invites row being inserted
//
// Deploy with `supabase functions deploy notify-events --no-verify-jwt`
// (a database trigger has no user JWT to present — see the migration file
// for the WEBHOOK_SECRET setup this depends on instead) and set secrets:
//   supabase secrets set RESEND_API_KEY=...
//   supabase secrets set WEBHOOK_SECRET=...        (same value as the DB setting)
//   supabase secrets set RESEND_FROM_EMAIL="dēmos <notifications@yourdomain>"  (optional)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'dēmos <onboarding@resend.dev>'

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

type VotingSessionRecord = {
  id: string
  workspace_id: string
  title: string
  status: string
  who_can_vote: 'all_members' | 'invited_list' | 'public_link'
}

type InviteRecord = {
  id: string
  workspace_id: string | null
  created_by: string
}

type NotificationDraft = {
  userId: string
  type: string
  payload: Record<string, unknown>
  emailSubject: string
  emailBody: string
}

Deno.serve(async (req) => {
  // Fails closed: with no WEBHOOK_SECRET configured, every request is
  // rejected rather than trusted, since --no-verify-jwt makes this URL
  // otherwise-unauthenticated. See the migration file for the matching
  // database-side setting.
  const provided = req.headers.get('x-webhook-secret')
  if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let drafts: NotificationDraft[] = []

  if (payload.table === 'voting_sessions' && payload.type === 'UPDATE' && payload.record) {
    drafts = await draftSessionStatusNotifications(
      supabase,
      payload.record as VotingSessionRecord,
      payload.old_record as { status: string } | null
    )
  } else if (payload.table === 'invites' && payload.type === 'INSERT' && payload.record) {
    drafts = await draftInviteNotifications(supabase, payload.record as InviteRecord)
  }

  if (drafts.length === 0) {
    return new Response(JSON.stringify({ notified: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error: insertError } = await supabase.from('notifications').insert(
    drafts.map((draft) => ({ user_id: draft.userId, type: draft.type, payload: draft.payload }))
  )

  if (insertError) {
    console.error('Failed to insert notifications:', insertError.message)
  }

  // Emails are sent independently of (and don't block on) the in-app
  // insert above — a bounced/slow email shouldn't stop other recipients'
  // in-app notifications from landing, and vice versa.
  await Promise.all(drafts.map((draft) => sendEmail(supabase, draft)))

  return new Response(JSON.stringify({ notified: drafts.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// Recipients per demos-system-design.md § 8.3: active workspace members for
// all_members sessions, session_access_grants for invited_list sessions.
// public_link sessions have no bounded recipient set (could be anyone with
// the link, including anonymous voters with no notifications row to write
// to) — deliberately not notified here.
async function draftSessionStatusNotifications(
  supabase: SupabaseClient,
  record: VotingSessionRecord,
  oldRecord: { status: string } | null
): Promise<NotificationDraft[]> {
  if (oldRecord?.status === record.status) return []
  if (record.status !== 'open' && record.status !== 'results_released') return []

  let recipientIds: string[] = []

  if (record.who_can_vote === 'all_members') {
    const { data } = await supabase
      .from('workspace_memberships')
      .select('user_id')
      .eq('workspace_id', record.workspace_id)
      .eq('status', 'active')
    recipientIds = (data ?? []).map((row) => row.user_id as string)
  } else if (record.who_can_vote === 'invited_list') {
    const { data } = await supabase
      .from('session_access_grants')
      .select('user_id')
      .eq('session_id', record.id)
    recipientIds = (data ?? []).map((row) => row.user_id as string)
  }

  const notifType = record.status === 'open' ? 'session_open' : 'session_results_released'
  const subject =
    record.status === 'open' ? `Voting is open: ${record.title}` : `Results are in: ${record.title}`
  const body =
    record.status === 'open'
      ? `"${record.title}" is now open for voting.`
      : `Results for "${record.title}" have been released.`

  return recipientIds.map((userId) => ({
    userId,
    type: notifType,
    payload: { sessionId: record.id, sessionTitle: record.title, workspaceId: record.workspace_id },
    emailSubject: subject,
    emailBody: body,
  }))
}

// Recipients: the workspace's other active admins (not the creator — they
// already know, they just created it). Not specified in § 8.4 beyond
// "invite created" as a trigger condition; this is the most sensible
// reading, since an invite is a shareable code with no bound recipient at
// creation time — nobody has redeemed it yet.
async function draftInviteNotifications(
  supabase: SupabaseClient,
  record: InviteRecord
): Promise<NotificationDraft[]> {
  if (!record.workspace_id) return []

  const [{ data: workspace }, { data: admins }] = await Promise.all([
    supabase.from('workspaces').select('name').eq('id', record.workspace_id).single(),
    supabase
      .from('workspace_memberships')
      .select('user_id')
      .eq('workspace_id', record.workspace_id)
      .eq('status', 'active')
      .eq('role', 'admin'),
  ])

  const recipientIds = (admins ?? [])
    .map((row) => row.user_id as string)
    .filter((userId) => userId !== record.created_by)

  const workspaceName = workspace?.name ?? 'your workspace'

  return recipientIds.map((userId) => ({
    userId,
    type: 'workspace_invite_created',
    payload: { workspaceId: record.workspace_id, inviteId: record.id },
    emailSubject: `New invite created for ${workspaceName}`,
    emailBody: `A new invite link was generated for ${workspaceName}.`,
  }))
}

// public.profiles has no email column (see supabase/migrations/002_profiles.sql)
// — email only lives in auth.users, which isn't exposed via the REST API, so
// the Admin API (available here because this function runs with the service
// role key) is how a recipient's email actually gets resolved.
async function sendEmail(supabase: SupabaseClient, draft: NotificationDraft): Promise<void> {
  const { data, error } = await supabase.auth.admin.getUserById(draft.userId)

  if (error || !data?.user?.email) {
    // Anonymous users have no email; lookup failures shouldn't take down
    // the rest of the batch — the in-app notification already landed.
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: data.user.email,
        subject: draft.emailSubject,
        text: draft.emailBody,
      }),
    })

    if (!response.ok) {
      console.error('Resend request failed:', response.status, await response.text())
    }
  } catch (err) {
    console.error('Resend request threw:', err)
  }
}
