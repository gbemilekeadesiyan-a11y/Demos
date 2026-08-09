import { createClient } from '@/lib/supabase/server'
import { getWorkspaceDetails } from '../../workspaces/_lib/actions'
import type { Workspace, WorkspaceMembership } from '../../workspaces/_lib/schema'
import { WorkspaceDetailClient } from '@/components/WorkspaceDetailClient'

function buildFakeDetails(
  workspaceId: string,
  currentUserId: string | null
): { workspace: Workspace; members: WorkspaceMembership[]; pendingRequests: WorkspaceMembership[] } {
  const now = new Date().toISOString()
  const adminId = currentUserId ?? 'fake-admin'

  return {
    workspace: {
      id: workspaceId,
      name: 'The Family Chat',
      type: 'ff',
      createdBy: { id: adminId, username: 'you', firstName: 'You', lastName: '' },
      settings: {},
    },
    members: [
      {
        id: 'fake-m1',
        workspace_id: workspaceId,
        user_id: adminId,
        role: 'admin',
        status: 'active',
        initiated_by: 'self',
        created_at: now,
        user: { id: adminId, username: 'you', firstName: 'You', lastName: '' },
      },
      {
        id: 'fake-m2',
        workspace_id: workspaceId,
        user_id: 'fake-user-2',
        role: 'member',
        status: 'active',
        initiated_by: 'self',
        created_at: now,
        user: { id: 'fake-user-2', username: 'jane.doe', firstName: 'Jane', lastName: 'Doe' },
      },
    ],
    pendingRequests: [],
  }
}

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let details: { workspace: Workspace; members: WorkspaceMembership[]; pendingRequests: WorkspaceMembership[] }
  let usingFakeData = false

  try {
    const result = await getWorkspaceDetails(id)
    if (!result.success || !result.workspace || !result.members) {
      throw new Error(result.error ?? 'Could not load group')
    }
    details = {
      workspace: result.workspace,
      members: result.members,
      pendingRequests: result.pendingRequests ?? [],
    }
  } catch {
    usingFakeData = true
    details = buildFakeDetails(id, user?.id ?? null)
  }

  const isAdmin = details.members.some((member) => member.user_id === user?.id && member.role === 'admin')

  return (
    <WorkspaceDetailClient
      workspaceId={id}
      workspace={details.workspace}
      currentUserId={user?.id ?? null}
      initialMembers={details.members}
      initialPendingRequests={details.pendingRequests}
      isAdmin={isAdmin}
      usingFakeData={usingFakeData}
    />
  )
}
