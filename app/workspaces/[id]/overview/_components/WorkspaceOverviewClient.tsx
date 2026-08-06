'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import type { WorkspaceSessionSummary, WorkspaceStats } from '../../../_lib/schema'

type FilterTab = 'all' | 'active' | 'closed'

const STATUS_META: Record<
  WorkspaceSessionSummary['status'],
  { label: string; badgeClass: string }
> = {
  draft: { label: 'Draft', badgeClass: 'border border-border-strong bg-foreground/5 text-muted' },
  open: { label: 'Active', badgeClass: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  closed: { label: 'Closed', badgeClass: 'border border-amber-500/30 bg-amber-500/10 text-amber-400' },
  results_released: { label: 'Closed', badgeClass: 'border border-amber-500/30 bg-amber-500/10 text-amber-400' },
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

// null means the previous period had no data to compare against (e.g. a
// brand-new workspace) — rendering "+N" there would overstate a baseline
// that never existed, so the indicator is hidden entirely rather than
// shown as a delta against zero.
function TrendBadge({ value, isPercent }: { value: number | null | undefined; isPercent: boolean }) {
  if (value === null || value === undefined) {
    return null
  }

  const rounded = isPercent ? Math.round(value * 10) / 10 : Math.round(value)
  const arrow = rounded > 0 ? '↗' : rounded < 0 ? '↘' : '→'
  const colorClass = rounded > 0 ? 'text-emerald-400' : rounded < 0 ? 'text-red-400' : 'text-muted'
  const magnitude = Math.abs(rounded)
  const label = `${rounded >= 0 ? '+' : '−'}${magnitude}${isPercent ? '%' : ''}`

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <span aria-hidden="true">{arrow}</span>
      {label}
    </span>
  )
}

function StatCard({
  label,
  value,
  trend,
}: {
  label: string
  value: string
  trend?: { value: number | null | undefined; isPercent: boolean }
}) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-5 backdrop-blur-md">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="font-heading text-3xl text-foreground">{value}</p>
        {trend && <TrendBadge value={trend.value} isPercent={trend.isPercent} />}
      </div>
    </div>
  )
}

function SessionCard({ session }: { session: WorkspaceSessionSummary }) {
  const meta = STATUS_META[session.status]

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="flex flex-col rounded-2xl border border-foreground/10 bg-foreground/5 p-5 backdrop-blur-md transition hover:border-foreground/20 hover:bg-foreground/[0.07]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{session.title}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.badgeClass}`}>
          {meta.label}
        </span>
      </div>

      {session.description && <p className="mt-1.5 line-clamp-2 text-xs text-muted">{session.description}</p>}

      <p className="mt-3 text-[11px] text-subtle">Last activity: {formatRelativeTime(session.lastActivity)}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-divider pt-4">
        <div>
          <p className="text-[11px] text-subtle">Votes Cast</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">{session.voteCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] text-subtle">Turnout</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {session.turnoutPct === null ? '—' : `${session.turnoutPct}%`}
          </p>
        </div>
      </div>
    </Link>
  )
}

export function WorkspaceOverviewClient({
  workspaceId,
  workspaceName,
  isAuthorized,
  errorMessage,
  stats,
  sessions,
}: {
  workspaceId: string
  workspaceName: string
  isAuthorized: boolean
  errorMessage?: string
  stats: WorkspaceStats | null
  sessions: WorkspaceSessionSummary[]
}) {
  const [tab, setTab] = useState<FilterTab>('all')

  const filtered = sessions.filter((session) => {
    if (tab === 'active') return session.status === 'open'
    if (tab === 'closed') return session.status === 'closed' || session.status === 'results_released'
    return true
  })

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-12 sm:px-8">
      <AuraBackground />

      <div className="relative mx-auto max-w-6xl">
        <Link href={`/workspaces/${workspaceId}`} className="text-sm text-muted transition hover:text-foreground">
          ← Back to workspace
        </Link>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-foreground">{workspaceName}</h1>
            <p className="mt-1 text-sm text-muted">Overview of sessions and participation across this workspace.</p>
          </div>

          <Link
            href={`/sessions/create?workspaceId=${workspaceId}&workspaceType=standard`}
            className="rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            + Create Session
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
                value={stats?.averageTurnout === null || stats?.averageTurnout === undefined
                  ? '—'
                  : `${Math.round(stats.averageTurnout * 10) / 10}%`}
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
                      tab === t
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted hover:bg-foreground/5 hover:text-foreground'
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
                    <SessionCard key={session.id} session={session} />
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
