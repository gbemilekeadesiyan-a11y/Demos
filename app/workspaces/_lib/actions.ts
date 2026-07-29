'use server'

import { randomBytes } from 'crypto'
import { createClient } from '../../../lib/supabase/server'
import type { Workspace, WorkspaceMembership } from './schema'

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

export async function listMyWorkspaces(): Promise<{
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

  const { data, error } = await supabase
    .from('workspace_memberships')
    .select('workspaces (id, name, type, created_by, settings)')
    .eq('user_id', user.id)
    .eq('status', 'active')

  if (error) {
    return { success: false, error: error.message }
  }

  const workspaces = (data ?? [])
    .map((row) => (row as unknown as { workspaces: Workspace | null }).workspaces)
    .filter((workspace): workspace is Workspace => workspace !== null)

  return { success: true, workspaces }
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
