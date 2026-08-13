import Link from 'next/link'

// Shared between WorkspaceOverviewClient (admin analytics page) and
// WorkspaceDashboardClient (the everyday session list) — both want the same
// "session overview" card. voteCount/turnoutPct are nullable here (unlike
// WorkspaceSessionSummary, where they're always populated) because the
// dashboard shows this card to non-admins too, who only get the plain
// listSessions fields — get_workspace_session_summaries
// (016_workspace_stats.sql) is admin-gated, so there's no turnout/vote
// figure to show them at all, not just a zero.
export type SessionCardData = {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'closed' | 'results_released'
  lastActivity: string
  voteCount: number | null
  turnoutPct: number | null
}

export const SESSION_STATUS_META: Record<
  SessionCardData['status'],
  { label: string; badgeClass: string }
> = {
  draft: { label: 'Draft', badgeClass: 'border border-border-strong bg-foreground/5 text-muted' },
  open: { label: 'Active', badgeClass: 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  closed: { label: 'Closed', badgeClass: 'border border-amber-500/30 bg-amber-500/10 text-amber-400' },
  results_released: { label: 'Closed', badgeClass: 'border border-amber-500/30 bg-amber-500/10 text-amber-400' },
}

export function formatRelativeTime(iso: string): string {
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
export function TrendBadge({ value, isPercent }: { value: number | null | undefined; isPercent: boolean }) {
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

export function StatCard({
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

export function SessionSummaryCard({ session }: { session: SessionCardData }) {
  const meta = SESSION_STATUS_META[session.status]

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
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {session.voteCount === null ? '—' : session.voteCount.toLocaleString()}
          </p>
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
