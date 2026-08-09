import { createClient } from '@/lib/supabase/server'
import { getWorkspaceSessionSummaries, getWorkspaceStats } from '../../../workspaces/_lib/actions'
import { WorkspaceOverviewClient } from '@/components/WorkspaceOverviewClient'

export default async function FamilyOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: workspace } = await supabase.from('workspaces').select('id, name, type').eq('id', id).single()

  // Both calls are admin-gated server-side (see get_workspace_stats /
  // get_workspace_session_summaries in supabase/migrations/016_workspace_stats.sql)
  // — success:false here means "not an admin", not "query failed", so it
  // doubles as this page's own authorization check rather than trusting a
  // separate client-side isAdmin flag. Reused straight from the workspaces
  // feature: both surfaces' groups are workspaces rows underneath (see
  // supabase/migrations/015_surface_access.sql), so the same aggregate
  // RPCs work regardless of which surface's route called them.
  const [statsResult, sessionsResult] = await Promise.all([
    getWorkspaceStats(id),
    getWorkspaceSessionSummaries(id),
  ])

  const isAuthorized = statsResult.success && sessionsResult.success

  return (
    <WorkspaceOverviewClient
      workspaceId={id}
      workspaceName={workspace?.name ?? 'Group'}
      workspaceType={workspace?.type === 'ff' ? 'ff' : 'standard'}
      isAuthorized={isAuthorized}
      errorMessage={!isAuthorized ? (statsResult.error ?? sessionsResult.error ?? 'Not authorized') : undefined}
      stats={statsResult.stats ?? null}
      sessions={sessionsResult.sessions ?? []}
    />
  )
}
