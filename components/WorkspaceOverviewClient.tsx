'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import { SessionSummaryCard, StatCard } from '@/components/SessionOverviewCards'
import type { WorkspaceSessionSummary, WorkspaceStats } from '@/app/workspaces/_lib/schema'

type FilterTab = 'all' | 'active' | 'closed'
type WorkspaceType = 'standard' | 'ff'

// Copy/route/accent treatment per workspace.type — same pattern as
// WorkspaceDashboardClient's THEME/SURFACE_CHROME. base picks which
// top-level surface route (/workspaces or /family) this session's links
// resolve under.
const OVERVIEW_THEME: Record<
  WorkspaceType,
  { base: string; backLabel: string; accentBtnClass: string; tabActiveClass: string; createLabel: string }
> = {
  standard: {
    base: '/workspaces',
    backLabel: 'Back to workspace',
    accentBtnClass: 'bg-accent text-accent-foreground',
    tabActiveClass: 'bg-accent text-accent-foreground',
    createLabel: '+ Create Session',
  },
  ff: {
    base: '/family',
    backLabel: 'Back to group',
    accentBtnClass: 'bg-fuchsia-500 text-white',
    tabActiveClass: 'bg-fuchsia-500 text-white',
    createLabel: '+ Create Poll',
  },
}

export function WorkspaceOverviewClient({
  workspaceId,
  workspaceName,
  workspaceType,
  isAuthorized,
  errorMessage,
  stats,
  sessions,
}: {
  workspaceId: string
  workspaceName: string
  workspaceType: WorkspaceType
  isAuthorized: boolean
  errorMessage?: string
  stats: WorkspaceStats | null
  sessions: WorkspaceSessionSummary[]
}) {
  const theme = OVERVIEW_THEME[workspaceType]
  const [tab, setTab] = useState<FilterTab>('all')

  const filtered = sessions.filter((session) => {
    if (tab === 'active') return session.status === 'open'
    if (tab === 'closed') return session.status === 'closed' || session.status === 'results_released'
    return true
  })

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-12 sm:px-8">
      <AuraBackground variant={workspaceType === 'ff' ? 'ff' : 'default'} />

      <div className="relative mx-auto max-w-6xl">
        <Link href={`${theme.base}/${workspaceId}`} className="text-sm text-muted transition hover:text-foreground">
          ← {theme.backLabel}
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-foreground">{workspaceName}</h1>
            <p className="mt-1 text-sm text-muted">Overview of sessions and participation across this workspace.</p>
          </div>

          <Link
            href={`/sessions/create?workspaceId=${workspaceId}&workspaceType=${workspaceType}`}
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition hover:opacity-90 ${theme.accentBtnClass}`}
          >
            {theme.createLabel}
          </Link>
        </div>

        {!isAuthorized ? (
          <p className="mt-10 rounded-lg border border-border bg-surface/60 px-4 py-3 text-sm text-muted">
            {errorMessage ?? 'Only workspace admins can view this overview.'}
          </p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Sessions"
                value={(stats?.totalSessions ?? 0).toLocaleString()}
                trend={{ value: stats?.trends?.totalSessions, isPercent: false }}
              />
              <StatCard
                label="Total Votes Cast"
                value={(stats?.totalVotes ?? 0).toLocaleString()}
                trend={{ value: stats?.trends?.totalVotes, isPercent: false }}
              />
              <StatCard
                label="Average Turnout"
                value={
                  stats?.averageTurnout === null || stats?.averageTurnout === undefined
                    ? '—'
                    : `${Math.round(stats.averageTurnout * 10) / 10}%`
                }
                trend={{ value: stats?.trends?.averageTurnout, isPercent: true }}
              />
              <StatCard label="Active Sessions" value={(stats?.activeSessions ?? 0).toLocaleString()} />
            </div>

            <div className="mt-10 flex items-center justify-between">
              <h2 className="font-heading text-xl text-foreground">All Sessions</h2>
              <div className="flex gap-1 rounded-full border border-border bg-surface/60 p-1 text-xs">
                {(['all', 'active', 'closed'] as FilterTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3 py-1.5 font-medium capitalize transition ${
                      tab === t ? theme.tabActiveClass : 'text-muted hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              {filtered.length === 0 ? (
                <p className="py-8 text-sm text-muted">No sessions here yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((session) => (
                    <SessionSummaryCard key={session.id} session={session} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
