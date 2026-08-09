import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listMyWorkspaces } from '@/app/workspaces/_lib/actions'
import { SettingsClient } from './_components/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, first_name, last_name')
    .eq('id', user.id)
    .single()

  // Both surfaces' memberships in one "leave" list — F&F groups and
  // Workspaces are both just workspaces rows (015_surface_access.sql), so
  // there's no reason to split this into two sections.
  const [workspacesResult, groupsResult] = await Promise.all([
    listMyWorkspaces('workspaces'),
    listMyWorkspaces('ff'),
  ])

  const memberships = [...(workspacesResult.workspaces ?? []), ...(groupsResult.workspaces ?? [])]

  return (
    <SettingsClient
      currentUserId={user.id}
      email={user.email ?? ''}
      username={profile?.username ?? ''}
      firstName={profile?.first_name ?? ''}
      lastName={profile?.last_name ?? ''}
      memberships={memberships}
    />
  )
}
