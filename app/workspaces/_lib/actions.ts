'use server'

import type { Workspace } from './schema'

export async function createWorkspace(formData: {
  name: string
  type: 'standard' | 'ff'
}): Promise<{ success: boolean; error?: string; workspaceId?: string }> {
  throw new Error('not implemented')
}

export async function generateInvite(
  workspaceId: string,
  options: { requiresVerification: boolean; expiresAt?: string; maxUses?: number }
): Promise<{ success: boolean; error?: string; inviteCode?: string }> {
  throw new Error('not implemented')
}

export async function joinWorkspaceByCode(
  code: string
): Promise<{ success: boolean; error?: string; workspaceId?: string; status?: 'active' | 'pending' }> {
  throw new Error('not implemented')
}

export async function approveMembership(
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function rejectMembership(
  membershipId: string
): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function updateMemberRole(
  membershipId: string,
  role: 'admin' | 'moderator' | 'member'
): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export async function listMyWorkspaces(): Promise<{
  success: boolean
  error?: string
  workspaces?: Workspace[]
}> {
  throw new Error('not implemented')
}
