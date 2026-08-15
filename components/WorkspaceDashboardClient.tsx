'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { SwitchSurfaceControl } from '@/components/SwitchSurfaceControl'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SessionSummaryCard, StatCard, type SessionCardData } from '@/components/SessionOverviewCards'
import { signOut } from '@/app/(auth)/_lib/actions'
import type { UserSummary } from '@/app/(auth)/_lib/schema'
import { listSessions } from '@/app/sessions/_lib/actions'
import type { VotingSession } from '@/app/sessions/_lib/schema'
import { NotificationBell } from '@/app/notifications/_components/NotificationBell'
import type { Notification } from '@/app/notifications/_lib/schema'
import { getWorkspaceSessionSummaries, getWorkspaceStats } from '@/app/workspaces/_lib/actions'
import type { Workspace, WorkspaceSessionSummary, WorkspaceStats } from '@/app/workspaces/_lib/schema'

type Tab = 'active' | 'drafts' | 'history'
type WorkspaceType = 'standard' | 'ff'
type Surface = 'workspaces' | 'ff'

// Visual treatment per workspace.type — same "identical layout/components,
// only visual treatment differs" rule as before, just a lot smaller now:
// the session grid itself (SessionSummaryCard, shared with
// WorkspaceOverviewClient) no longer forks into a table vs. a
// gradient-card layout — one shared card style for both, colored by type.
const TYPE_THEME: Record<
  WorkspaceType,
  {
    accentBtnClass: string
    tabActiveClass: string
    tabLabel: Record<Tab, string>
    greeting: boolean
  }
> = {
  standard: {
    accentBtnClass: 'bg-accent text-accent-foreground',
    tabActiveClass: 'bg-accent text-accent-foreground',
    tabLabel: { active: 'Active', drafts: 'Drafts', history: 'History' },
    greeting: false,
  },
  ff: {
    accentBtnClass: 'bg-fuchsia-500 text-white',
    tabActiveClass: 'bg-fuchsia-500 text-white',
    tabLabel: { active: 'Active Polls', drafts: 'Drafts', history: 'Past Results' },
    greeting: true,
  },
}

// The sidebar/nav chrome that differs per *surface* (which top-level route
// this is), independent of any individual workspace's type — e.g. "Groups"
// vs "Workspaces" is about the section label on /family vs /workspaces, not
// about any one row's own visual treatment (that's TYPE_THEME above).
const SURFACE_CHROME: Record<
  Surface,
  {
    navActiveClass: string
    homeHoverClass: string
    sectionLabel: string
    createLabel: string
    createHref: string
    createHoverClass: string
    sessionLabel: string
    emptyNoun: string
    listActiveClass: string
    sessionWorkspaceType: WorkspaceType
  }
> = {
  workspaces: {
    navActiveClass: 'bg-accent/10 text-accent',
    homeHoverClass: 'hover:text-foreground',
    sectionLabel: 'Workspaces',
    createLabel: '+ New Workspace',
    createHref: '/workspaces/create',
    createHoverClass: 'hover:border-accent hover:text-accent',
    sessionLabel: '+ Create Session',
    emptyNoun: 'workspaces',
    listActiveClass: 'bg-accent/10 text-accent',
    sessionWorkspaceType: 'standard',
  },
  ff: {
    navActiveClass: 'bg-fuchsia-500/10 text-fuchsia-300',
    homeHoverClass: 'hover:text-fuchsia-300',
    sectionLabel: 'Groups',
    createLabel: '+ New Group',
    createHref: '/family/create',
    createHoverClass: 'hover:border-fuchsia-400 hover:text-fuchsia-300',
    sessionLabel: '+ Create Poll',
    emptyNoun: 'groups',
    listActiveClass: 'bg-fuchsia-500/10 text-fuchsia-300',
    sessionWorkspaceType: 'ff',
  },
}

function greetingPhrase(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function currentUserDisplayName(user: UserSummary | null) {
  if (!user) return 'Guest'
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  return fullName || user.username
}

export function WorkspaceDashboardClient({
  surface,
  workspaces,
  initialWorkspaceId,
  initialSessions,
  sessionsError,
  currentUser,
  currentUserId,
  initialNotifications,
  canSwitchSurface,
}: {
  surface: Surface
  workspaces: Workspace[]
  initialWorkspaceId: string | null
  initialSessions: VotingSession[]
  sessionsError: boolean
  currentUser: UserSummary | null
  currentUserId: string | null
  initialNotifications: Notification[]
  canSwitchSurface: boolean
}) {
  const router = useRouter()
  const chrome = SURFACE_CHROME[surface]
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId)
  const [sessions, setSessions] = useState(initialSessions)
  const [sessionsFailedToLoad, setSessionsFailedToLoad] = useState(sessionsError)
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)

  // Per-session vote count/turnout/last-activity and the workspace-wide
  // stat cards — both come from the same admin-gated aggregate RPCs the
  // overview page uses (get_workspace_stats / get_workspace_session_summaries,
  // 016_workspace_stats.sql). A non-admin's calls come back success:false;
  // that's the signal to just skip the stats row and render session cards
  // without vote/turnout figures, rather than a separate isAdmin prop.
  const [statsData, setStatsData] = useState<WorkspaceStats | null>(null)
  const [summaryById, setSummaryById] = useState<Map<string, WorkspaceSessionSummary>>(new Map())
  const [statsAvailable, setStatsAvailable] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.push('/')
    router.refresh()
  }

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
  const theme = TYPE_THEME[selectedWorkspace?.type === 'ff' ? 'ff' : 'standard']

  async function selectWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId)
    setLoading(true)
    setTab('active')

    const result = await listSessions(workspaceId)
    setLoading(false)

    if (result.success) {
      setSessions(result.sessions ?? [])
      setSessionsFailedToLoad(false)
    } else {
      setSessions([])
      setSessionsFailedToLoad(true)
    }
  }

  useEffect(() => {
    if (!selectedWorkspaceId || sessionsFailedToLoad) {
      setStatsData(null)
      setSummaryById(new Map())
      setStatsAvailable(false)
      return
    }

    let cancelled = false

    async function loadStats() {
      const [statsResult, summariesResult] = await Promise.all([
        getWorkspaceStats(selectedWorkspaceId!),
        getWorkspaceSessionSummaries(selectedWorkspaceId!),
      ])
      if (cancelled) return

      setStatsAvailable(statsResult.success)
      setStatsData(statsResult.success ? (statsResult.stats ?? null) : null)
      setSummaryById(
        summariesResult.success
          ? new Map((summariesResult.sessions ?? []).map((session) => [session.id, session]))
          : new Map()
      )
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [selectedWorkspaceId, sessionsFailedToLoad])

  const filtered = sessions.filter((session) => {
    if (tab === 'active') return session.status === 'open'
    if (tab === 'drafts') return session.status === 'draft'
    return session.status === 'closed' || session.status === 'results_released'
  })

  function toCardData(session: VotingSession): SessionCardData {
    const summary = summaryById.get(session.id)
    return {
      id: session.id,
      title: session.title,
      description: session.description,
      status: session.status,
      lastActivity: summary?.lastActivity ?? session.created_at,
      voteCount: summary?.voteCount ?? null,
      turnoutPct: summary?.turnoutPct ?? null,
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <AuraBackground variant={surface === 'ff' ? 'ff' : 'default'} />

      <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-divider bg-background/80 px-4 py-6">
        <Link
          href="/"
          className={`mb-4 flex items-center gap-1.5 px-1 text-xs text-muted transition ${chrome.homeHoverClass}`}
        >
          <span aria-hidden="true">←</span> Back to home
        </Link>

        <div className="mb-8 flex items-center justify-between px-1">
          <Link href="/" className="flex items-center">
            <Logo className="h-6 w-auto text-foreground" />
          </Link>
          <NotificationBell userId={currentUserId} initialNotifications={initialNotifications} />
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          <span className={`rounded-lg px-3 py-2 ${chrome.navActiveClass}`}>Dashboard</span>
          <Link
            href="/join"
            className="rounded-lg px-3 py-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Join by Code
          </Link>
        </nav>

        <p className="mb-2 mt-8 px-3 text-xs uppercase tracking-wide text-subtle">{chrome.sectionLabel}</p>
        <div className="flex flex-col gap-1">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => selectWorkspace(workspace.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                workspace.id === selectedWorkspaceId
                  ? chrome.listActiveClass
                  : 'text-muted hover:bg-foreground/5 hover:text-foreground'
              }`}
            >
              {workspace.name}
            </button>
          ))}
          {workspaces.length === 0 && <p className="px-3 text-xs text-subtle">No {chrome.emptyNoun} yet.</p>}
        </div>

        <Link
          href={chrome.createHref}
          className={`mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted transition ${chrome.createHoverClass}`}
        >
          {chrome.createLabel}
        </Link>

        <div className="mt-auto border-t border-divider pt-4">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-border-strong text-xs font-medium text-foreground">
                {currentUserDisplayName(currentUser).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{currentUserDisplayName(currentUser)}</p>
                {currentUser && <p className="truncate text-xs text-muted">@{currentUser.username}</p>}
              </div>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>
          <div className="flex flex-col gap-1">
            <Link
              href="/settings"
              className="rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
            >
              Settings
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-foreground/5 hover:text-foreground"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex-1 px-8 py-10">
        {canSwitchSurface && (
          <div className="mb-6 flex justify-end">
            <SwitchSurfaceControl current={surface} />
          </div>
        )}

        {!selectedWorkspace ? (
          <p className="text-sm text-muted">
            You&apos;re not in any {chrome.emptyNoun} yet.{' '}
            <Link href={chrome.createHref} className="underline">
              Create one
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <>
            {theme.greeting && (
              <p className="text-sm text-muted">
                {greetingPhrase()}, {currentUser?.firstName?.trim() || 'there'}!
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-heading text-3xl text-foreground">{selectedWorkspace.name}</h1>
              <div className="flex items-center gap-2">
                <Link
                  href={`${surface === 'ff' ? '/family' : '/workspaces'}/${selectedWorkspace.id}`}
                  className="rounded-full border border-border px-4 py-2 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
                >
                  Members &amp; Invites
                </Link>
                <Link
                  href={`/sessions/create?workspaceId=${selectedWorkspaceId}&workspaceType=${selectedWorkspace.type}`}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition hover:opacity-90 ${theme.accentBtnClass}`}
                >
                  {chrome.sessionLabel}
                </Link>
              </div>
            </div>

            {statsAvailable && statsData && (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Total Sessions"
                  value={statsData.totalSessions.toLocaleString()}
                  trend={{ value: statsData.trends?.totalSessions, isPercent: false }}
                />
                <StatCard
                  label="Total Votes Cast"
                  value={statsData.totalVotes.toLocaleString()}
                  trend={{ value: statsData.trends?.totalVotes, isPercent: false }}
                />
                <StatCard
                  label="Average Turnout"
                  value={statsData.averageTurnout === null ? '—' : `${Math.round(statsData.averageTurnout * 10) / 10}%`}
                  trend={{ value: statsData.trends?.averageTurnout, isPercent: true }}
                />
                <StatCard label="Active Sessions" value={statsData.activeSessions.toLocaleString()} />
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <h2 className="font-heading text-xl text-foreground">Sessions</h2>
              <div className="flex gap-1 rounded-full border border-border bg-surface/60 p-1 text-xs">
                {(['active', 'drafts', 'history'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`rounded-full px-3 py-1.5 font-medium transition ${
                      tab === t ? theme.tabActiveClass : 'text-muted hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    {theme.tabLabel[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              {loading ? (
                <p className="py-8 text-sm text-muted">Loading…</p>
              ) : sessionsFailedToLoad ? (
                <p className="py-8 text-sm text-red-400">Couldn&apos;t load sessions for this workspace.</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-sm text-muted">No sessions here yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((session) => (
                    <SessionSummaryCard key={session.id} session={toCardData(session)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
