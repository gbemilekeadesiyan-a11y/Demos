'use server'

import { randomBytes } from 'crypto'
import { createClient } from '../../../lib/supabase/server'
import type { UserSummary } from '../../(auth)/_lib/schema'
import type {
  DepartmentWithMembers,
  Workspace,
  WorkspaceMembership,
  WorkspaceSessionSummary,
  WorkspaceStats,
} from './schema'

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

  // Scoped to 'self'-initiated rows (someone requested to join) — this is
  // the admin-approves-a-request direction. An admin-initiated invite
  // ('admin') is accepted/declined by the invited user via respondToInvite,
  // not approved by an admin here. See
  // supabase/migrations/017_workspace_ownership_and_invites.sql.
  const { error } = await supabase
    .from('workspace_memberships')
    .update({ status: 'active' })
    .eq('id', membershipId)
    .eq('status', 'pending')
    .eq('initiated_by', 'self')
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

  // Same 'self'-initiated scoping as approveMembership above.
  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('id', membershipId)
    .eq('status', 'pending')
    .eq('initiated_by', 'self')
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Admin invites a specific person by username or email — distinct from
// generateInvite's shareable code. The invited user shows up as a
// 'pending'/'admin'-initiated membership and responds via respondToInvite
// below. See invite_by_identifier in
// supabase/migrations/017_workspace_ownership_and_invites.sql for identifier
// resolution, the "already a member" guard, and the notification insert —
// all done together as a security-definer RPC since a regular client can't
// insert a membership row for someone else, or a notification for anyone
// but themselves, under RLS.
export async function inviteByIdentifier(
  workspaceId: string,
  identifier: string,
  role: 'admin' | 'moderator' | 'member'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('invite_by_identifier', {
    p_workspace_id: workspaceId,
    p_identifier: identifier,
    p_role: role,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not send invite' }
  }

  return { success: true }
}

// The invited user's response to an admin-initiated invite — distinct from
// approveMembership, which is the admin-approves-a-request direction (see
// that function's comment). accept: true activates the membership; false
// deletes it.
export async function respondToInvite(
  membershipId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('respond_to_invite', {
    p_membership_id: membershipId,
    p_accept: accept,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not respond to invite' }
  }

  return { success: true }
}

export async function leaveWorkspace(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Checked up front for a friendly message — RLS (017_*.sql) blocks the
  // delete below regardless, so this isn't the only thing standing between
  // an owner and accidentally removing their own membership.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('created_by')
    .eq('id', workspaceId)
    .single()

  if (workspace?.created_by === user.id) {
    return { success: false, error: 'Transfer ownership before leaving.' }
  }

  const { error } = await supabase
    .from('workspace_memberships')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// The only way workspaces.created_by can change — enforced by a trigger,
// not just by this function existing (see prevent_direct_ownership_change
// in supabase/migrations/017_workspace_ownership_and_invites.sql). Caller
// must be the *current* owner; the new owner must already be an active
// member and is promoted to role = 'admin' if they aren't already.
export async function transferOwnership(
  workspaceId: string,
  newOwnerUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('transfer_workspace_ownership', {
    p_workspace_id: workspaceId,
    p_new_owner_user_id: newOwnerUserId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not transfer ownership' }
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

// Departments — the WorkspaceGroup entity deferred in
// demos-system-design.md § 3. Workspaces-only, not F&F: RLS
// (018_departments.sql) rejects creation under an ff workspace at the
// database layer, so createDepartment surfaces whatever error message that
// produces rather than needing its own type check here.
export async function createDepartment(
  workspaceId: string,
  name: string
): Promise<{ success: boolean; error?: string; groupId?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workspace_groups')
    .insert({ workspace_id: workspaceId, name })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, groupId: data.id }
}

export async function renameDepartment(
  groupId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workspace_groups')
    .update({ name })
    .eq('id', groupId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteDepartment(groupId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // workspace_group_members rows cascade on delete (018_departments.sql) —
  // no separate cleanup needed here.
  const { error } = await supabase.from('workspace_groups').delete().eq('id', groupId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function listDepartments(workspaceId: string): Promise<{
  success: boolean
  error?: string
  departments?: DepartmentWithMembers[]
}> {
  const supabase = await createClient()

  // Embeds workspace_group_members in the same query (one round trip for
  // every department's roster) rather than a listDepartmentMembers call
  // per department.
  const { data, error } = await supabase
    .from('workspace_groups')
    .select('id, workspace_id, name, created_at, workspace_group_members (membership_id)')
    .eq('workspace_id', workspaceId)
    .order('name')

  if (error) {
    return { success: false, error: error.message }
  }

  type Row = {
    id: string
    workspace_id: string
    name: string
    created_at: string
    workspace_group_members: { membership_id: string }[]
  }

  const departments: DepartmentWithMembers[] = ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    created_at: row.created_at,
    memberIds: row.workspace_group_members.map((member) => member.membership_id),
  }))

  return { success: true, departments }
}

// membershipId, not userId — department membership is scoped to the
// person's workspace_memberships row (018_departments.sql), so the caller
// needs to have that id already (e.g. from getWorkspaceDetails' member
// list), not just a bare user id.
export async function addMemberToDepartment(
  groupId: string,
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workspace_group_members')
    .insert({ group_id: groupId, membership_id: membershipId })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function removeMemberFromDepartment(
  groupId: string,
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('workspace_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('membership_id', membershipId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getWorkspaceDetails(workspaceId: string): Promise<{
  success: boolean
  error?: string
  workspace?: Workspace
  members?: WorkspaceMembership[]
  pendingRequests?: WorkspaceMembership[]
}> {
  const supabase = await createClient()

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, type, created_by, settings')
    .eq('id', workspaceId)
    .single()

  if (workspaceError || !workspaceRow) {
    return { success: false, error: workspaceError?.message ?? 'Workspace not found' }
  }

  // RLS ("Members and admins can view workspace memberships",
  // 003_workspaces.sql) already scopes this per caller — a non-admin gets
  // their own row (any status) plus every active row (the public roster);
  // an admin additionally gets every pending row. No extra filtering on
  // top of that is needed for "members" (active-only, below), but
  // pendingRequests naturally comes back empty for a non-admin caller
  // rather than needing an explicit admin check here.
  const { data: membershipRows, error: membershipError } = await supabase
    .from('workspace_memberships')
    .select('id, workspace_id, user_id, role, status, initiated_by, created_at')
    .eq('workspace_id', workspaceId)

  if (membershipError) {
    return { success: false, error: membershipError.message }
  }

  const rows = membershipRows ?? []
  const profiles = await fetchUserSummaries(supabase, [workspaceRow.created_by, ...rows.map((row) => row.user_id)])

  function toMembership(row: (typeof rows)[number]): WorkspaceMembership {
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      user_id: row.user_id,
      role: row.role,
      status: row.status,
      initiated_by: row.initiated_by,
      created_at: row.created_at,
      user: profiles.get(row.user_id) ?? null,
    }
  }

  const members = rows.filter((row) => row.status === 'active').map(toMembership)

  // Only 'self'-initiated pending rows (someone asked to join) belong here
  // — 'admin'-initiated pending rows (a direct invite) are the invited
  // user's own notification-driven accept/decline, not something an admin
  // approves from this list. See approveMembership/rejectMembership.
  const pendingRequests = rows
    .filter((row) => row.status === 'pending' && row.initiated_by === 'self')
    .map(toMembership)

  const workspace: Workspace = {
    id: workspaceRow.id,
    name: workspaceRow.name,
    type: workspaceRow.type,
    settings: workspaceRow.settings as Record<string, unknown>,
    createdBy: profiles.get(workspaceRow.created_by) ?? null,
  }

  return { success: true, workspace, members, pendingRequests }
}
