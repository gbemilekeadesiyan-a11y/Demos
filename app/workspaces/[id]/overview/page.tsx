import { createClient } from '@/lib/supabase/server'
import { getWorkspaceSessionSummaries, getWorkspaceStats } from '../../_lib/actions'
import { WorkspaceOverviewClient } from './_components/WorkspaceOverviewClient'

export default async function WorkspaceOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: workspace } = await supabase.from('workspaces').select('id, name').eq('id', id).single()

  // Both calls are admin-gated server-side (see get_workspace_stats /
  // get_workspace_session_summaries in supabase/migrations/016_workspace_stats.sql)
  // — success:false here means "not an admin", not "query failed", so it
  // doubles as this page's own authorization check rather than trusting a
  // separate client-side isAdmin flag.
  const [statsResult, sessionsResult] = await Promise.all([
    getWorkspaceStats(id),
    getWorkspaceSessionSummaries(id),
  ])

  const isAuthorized = statsResult.success && sessionsResult.success

  return (
    <WorkspaceOverviewClient
      workspaceId={id}
      workspaceName={workspace?.name ?? 'Workspace'}
      isAuthorized={isAuthorized}
      errorMessage={!isAuthorized ? (statsResult.error ?? sessionsResult.error ?? 'Not authorized') : undefined}
      stats={statsResult.stats ?? null}
      sessions={sessionsResult.sessions ?? []}
    />
  )
}
