'use server'

import { randomBytes } from 'crypto'
import { createClient } from '../../../lib/supabase/server'
import type { UserSummary } from '../../(auth)/_lib/schema'
import type { Workspace, WorkspaceMembership, WorkspaceSessionSummary, WorkspaceStats } from './schema'

type ProfileRow = { id: string; username: string; first_name: string; last_name: string }

// One batched profiles lookup for however many creator ids are in the
// result set — not a per-row round trip. Same pattern as
// app/sessions/_lib/actions.ts's fetchUserSummaries; kept local here since
// this file's supabase client instance isn't shared across features.
async function fetchUserSummaries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: (string | null | undefined)[]
): Promise<Map<string, UserSummary>> {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, UserSummary>()

  if (uniqueIds.length === 0) {
    return map
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name')
    .in('id', uniqueIds)

  for (const profile of (data ?? []) as ProfileRow[]) {
    map.set(profile.id, {
      id: profile.id,
      username: profile.username,
      firstName: profile.first_name,
      lastName: profile.last_name,
    })
  }

  return map
}

export async function createWorkspace(formData: {
  name: string
  type: 'standard' | 'ff'
}): Promise<{ success: boolean; error?: string; workspaceId?: string }> {
  const supabase = await createClient()

  // Wraps workspace creation + seeding the founding admin membership in one
  // transaction (see supabase/migrations/003_workspaces.sql) so the two
  // writes can't partially apply.
  const { data, error } = await supabase.rpc('create_workspace', {
    p_name: formData.name,
    p_type: formData.type,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string; workspace_id?: string }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not create workspace' }
  }

  return { success: true, workspaceId: result.workspace_id }
}

export async function generateInvite(
  workspaceId: string,
  options: { requiresVerification: boolean; expiresAt?: string; maxUses?: number }
): Promise<{ success: boolean; error?: string; inviteCode?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const code = randomBytes(6).toString('base64url')

  // RLS (workspace_memberships-backed) rejects this insert unless the
  // caller is an active admin of workspaceId.
  const { error } = await supabase.from('invites').insert({
    workspace_id: workspaceId,
    code,
    created_by: user.id,
    requires_verification: options.requiresVerification,
    expires_at: options.expiresAt ?? null,
    max_uses: options.maxUses ?? null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, inviteCode: code }
}

export async function joinWorkspaceByCode(
  code: string
): Promise<{ success: boolean; error?: string; workspaceId?: string; status?: 'active' | 'pending' }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('join_workspace_by_code', { p_code: code })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as {
    success: boolean
    error?: string
    workspace_id?: string
    status?: 'active' | 'pending'
  }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Invalid or expired code' }
  }

  return { success: true, workspaceId: result.workspace_id, status: result.status }
}

export async function approveMembership(
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workspace_memberships')
    .update({ status: 'active' })
    .eq('id', membershipId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function rejectMembership(
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('id', membershipId)
    .eq('status', 'pending')
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function updateMemberRole(
  membershipId: string,
  role: 'admin' | 'moderator' | 'member'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workspace_memberships')
    .update({ role })
    .eq('id', membershipId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function listMyWorkspaces(surface: 'ff' | 'workspaces'): Promise<{
  success: boolean
  error?: string
  workspaces?: Workspace[]
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // 'workspaces' surface maps to the 'standard' workspaces.type value
  // (003_workspaces.sql) — F&F groups are still workspaces rows, just
  // type = 'ff', so surface filtering is which type this listing wants,
  // not a separate table. `!inner` makes the .eq() below actually filter
  // out non-matching rows rather than just leaving their embedded
  // workspaces object null.
  const workspaceType = surface === 'ff' ? 'ff' : 'standard'

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspaces!inner (id, name, type, created_by, settings)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('workspaces.type', workspaceType)

  if (error) {
    return { success: false, error: error.message }
  }

  type WorkspaceRow = {
    id: string
    name: string
    type: 'standard' | 'ff'
    created_by: string
    settings: Record<string, unknown>
  }

  const rows = (data ?? [])
    .map((row) => (row as unknown as { workspaces: WorkspaceRow | null }).workspaces)
    .filter((row): row is WorkspaceRow => row !== null)

  const profiles = await fetchUserSummaries(
    supabase,
    rows.map((row) => row.created_by)
  )

  const workspaces: Workspace[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    settings: row.settings,
    createdBy: profiles.get(row.created_by) ?? null,
  }))

  return { success: true, workspaces }
}

export async function getWorkspaceStats(
  workspaceId: string
): Promise<{ success: boolean; error?: string; stats?: WorkspaceStats }> {
  const supabase = await createClient()

  // Aggregated server-side in one query — see get_workspace_stats in
  // supabase/migrations/016_workspace_stats.sql. Admin-gated there (not
  // just by RLS), since turnout/vote totals span sessions — invited_list
  // ones especially — a non-admin caller may have no access to at all.
  const { data, error } = await supabase.rpc('get_workspace_stats', { p_workspace_id: workspaceId })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string; stats?: WorkspaceStats }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not load workspace stats' }
  }

  return { success: true, stats: result.stats }
}

export async function getWorkspaceSessionSummaries(workspaceId: string): Promise<{
  success: boolean
  error?: string
  sessions?: WorkspaceSessionSummary[]
}> {
  const supabase = await createClient()

  // Same single-query aggregation and admin gate as getWorkspaceStats — see
  // get_workspace_session_summaries in supabase/migrations/016_workspace_stats.sql.
  const { data, error } = await supabase.rpc('get_workspace_session_summaries', {
    p_workspace_id: workspaceId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string; sessions?: WorkspaceSessionSummary[] }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not load sessions' }
  }

  return { success: true, sessions: result.sessions ?? [] }
}

export async function getWorkspaceDetails(workspaceId: string): Promise<{
  success: boolean
  error?: string
  workspace?: Workspace
  members?: WorkspaceMembership[]
  pendingRequests?: WorkspaceMembership[]
}> {
  throw new Error('not implemented')
}
