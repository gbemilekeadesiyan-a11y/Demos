import { createClient } from '@/lib/supabase/server'
import type { UserSummary } from '../(auth)/_lib/schema'
import { getSurfaceAccess } from '../(auth)/_lib/actions'
import { listMyWorkspaces } from '../workspaces/_lib/actions'
import type { Workspace } from '../workspaces/_lib/schema'
import { listSessions } from '../sessions/_lib/actions'
import type { VotingSession } from '../sessions/_lib/schema'
import { listNotifications } from '../notifications/_lib/actions'
import type { Notification } from '../notifications/_lib/schema'
import { FamilyDashboardClient } from './_components/FamilyDashboardClient'

function buildFakeSessions(workspaceId: string): VotingSession[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'fake-s1',
      workspace_id: workspaceId,
      title: 'Where should we eat lunch tomorrow?',
      description: null,
      vote_format: 'single',
      visibility: 'public',
      status: 'open',
      who_can_vote: 'all_members',
      allow_anonymous_vote: true,
      results_visibility: 'hidden_until_close',
      results_style: null,
      ballot_secrecy: 'open',
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-admin', username: 'you', firstName: 'You', lastName: '' },
      created_at: now,
    },
    {
      id: 'fake-s2',
      workspace_id: workspaceId,
      title: 'Best UI/UX design software',
      description: null,
      vote_format: 'single',
      visibility: 'public',
      status: 'closed',
      who_can_vote: 'public_link',
      allow_anonymous_vote: true,
      results_visibility: 'live',
      results_style: null,
      ballot_secrecy: 'open',
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-user-2', username: 'jane.doe', firstName: 'Jane', lastName: 'Doe' },
      created_at: now,
    },
    {
      id: 'fake-s3',
      workspace_id: workspaceId,
      title: 'Family trip destination',
      description: null,
      vote_format: 'ranked',
      visibility: 'public',
      status: 'results_released',
      who_can_vote: 'all_members',
      allow_anonymous_vote: false,
      results_visibility: 'after_you_vote',
      results_style: null,
      ballot_secrecy: 'open',
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-user-3', username: 'sam.lee', firstName: 'Sam', lastName: 'Lee' },
      created_at: now,
    },
  ]
}

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
  const groups: Workspace[] = groupsResult.success ? (groupsResult.workspaces ?? []) : []

  const surfaceAccess = user ? await getSurfaceAccess() : { success: false as const }
  const canSwitchSurface = Boolean(surfaceAccess.success && surfaceAccess.hasFf && surfaceAccess.hasWorkspaces)

  const initialGroupId = groups[0]?.id ?? null

  let initialSessions: VotingSession[] = []
  let usingFakeSessions = false

  if (initialGroupId) {
    const sessionsResult = await listSessions(initialGroupId)
    if (sessionsResult.success) {
      initialSessions = sessionsResult.sessions ?? []
    } else {
      usingFakeSessions = true
      initialSessions = buildFakeSessions(initialGroupId)
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
    <FamilyDashboardClient
      groups={groups}
      initialGroupId={initialGroupId}
      initialSessions={initialSessions}
      usingFakeSessions={usingFakeSessions}
      currentUser={currentUser}
      currentUserId={user?.id ?? null}
      initialNotifications={initialNotifications}
      canSwitchSurface={canSwitchSurface}
    />
  )
}
