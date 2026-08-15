import { createClient } from '@/lib/supabase/server'
import type { UserSummary } from '../(auth)/_lib/schema'
import { getSurfaceAccess } from '../(auth)/_lib/actions'
import { listMyWorkspaces } from '../workspaces/_lib/actions'
import type { Workspace } from '../workspaces/_lib/schema'
import { listSessions } from '../sessions/_lib/actions'
import type { VotingSession } from '../sessions/_lib/schema'
import { listNotifications } from '../notifications/_lib/actions'
import type { Notification } from '../notifications/_lib/schema'
import { WorkspaceDashboardClient } from '@/components/WorkspaceDashboardClient'

export default async function FamilyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let currentUser: UserSummary | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (profile) {
      currentUser = {
        id: profile.id,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
      }
    }
  }

  const groupsResult = await listMyWorkspaces('ff')
  const workspaces: Workspace[] = groupsResult.success ? (groupsResult.workspaces ?? []) : []

  const surfaceAccess = user ? await getSurfaceAccess() : { success: false as const }
  const canSwitchSurface = Boolean(surfaceAccess.success && surfaceAccess.hasFf && surfaceAccess.hasWorkspaces)

  const initialWorkspaceId = workspaces[0]?.id ?? null

  let initialSessions: VotingSession[] = []
  let sessionsError = false

  if (initialWorkspaceId) {
    const sessionsResult = await listSessions(initialWorkspaceId)
    if (sessionsResult.success) {
      initialSessions = sessionsResult.sessions ?? []
    } else {
      sessionsError = true
    }
  }

  let initialNotifications: Notification[] = []
  if (user) {
    const notificationsResult = await listNotifications()
    if (notificationsResult.success) {
      initialNotifications = notificationsResult.notifications ?? []
    }
  }

  return (
    <WorkspaceDashboardClient
      surface="ff"
      workspaces={workspaces}
      initialWorkspaceId={initialWorkspaceId}
      initialSessions={initialSessions}
      sessionsError={sessionsError}
      currentUser={currentUser}
      currentUserId={user?.id ?? null}
      initialNotifications={initialNotifications}
      canSwitchSurface={canSwitchSurface}
    />
  )
}
