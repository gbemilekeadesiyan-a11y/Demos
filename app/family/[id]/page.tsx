import { createClient } from '@/lib/supabase/server'
import { ErrorState } from '@/components/ErrorState'
import { getWorkspaceDetails } from '../../workspaces/_lib/actions'
import { WorkspaceDetailClient } from '@/components/WorkspaceDetailClient'

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const result = await getWorkspaceDetails(id)

  if (!result.success || !result.workspace || !result.members) {
    return <ErrorState message="Couldn't load this group." backHref="/family" backLabel="Back to dashboard" />
  }

  const workspace = result.workspace
  const members = result.members
  const pendingRequests = result.pendingRequests ?? []

  const isAdmin = members.some((member) => member.user_id === user?.id && member.role === 'admin')

  return (
    <WorkspaceDetailClient
      workspaceId={id}
      workspace={workspace}
      currentUserId={user?.id ?? null}
      initialMembers={members}
      initialPendingRequests={pendingRequests}
      isAdmin={isAdmin}
    />
  )
}
