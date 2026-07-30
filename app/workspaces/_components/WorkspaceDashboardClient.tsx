'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { signOut } from '@/app/(auth)/_lib/actions'
import type { UserSummary } from '@/app/(auth)/_lib/schema'
import { listSessions } from '../../sessions/_lib/actions'
import type { VotingSession } from '../../sessions/_lib/schema'
import type { Workspace } from '../_lib/schema'

type Tab = 'active' | 'drafts' | 'history'
type WorkspaceType = 'standard' | 'ff'

const THEME: Record<
  WorkspaceType,
  {
    tabActive: string
    rowHover: string
    badge: Record<VotingSession['status'], string>
    showAvatars: boolean
  }
> = {
  standard: {
    tabActive: 'border-foreground text-foreground',
    rowHover: 'hover:bg-surface/60',
    badge: {
      draft: 'text-muted',
      open: 'text-emerald-400',
      closed: 'text-amber-400',
      results_released: 'text-sky-400',
    },
    showAvatars: false,
  },
  ff: {
    tabActive: 'border-fuchsia-400 text-fuchsia-300',
    rowHover: 'hover:bg-fuchsia-950/20',
    badge: {
      draft: 'text-muted',
      open: 'text-fuchsia-400',
      closed: 'text-amber-300',
      results_released: 'text-emerald-300',
    },
    showAvatars: true,
  },
}

const STATUS_LABEL: Record<VotingSession['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  results_released: 'Results released',
}

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
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-admin', username: 'you', firstName: 'You', lastName: '' },
      created_at: now,
    },
    {
      id: 'fake-s2',
      workspace_id: workspaceId,
      title: 'Q3 roadmap priorities',
      description: null,
      vote_format: 'multiple',
      visibility: 'private',
      status: 'draft',
      who_can_vote: 'all_members',
      allow_anonymous_vote: false,
      results_visibility: 'hidden_until_close',
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-admin', username: 'you', firstName: 'You', lastName: '' },
      created_at: now,
    },
    {
      id: 'fake-s3',
      workspace_id: workspaceId,
      title: 'Best UI/UX design software',
      description: null,
      vote_format: 'single',
      visibility: 'public',
      status: 'closed',
      who_can_vote: 'public_link',
      allow_anonymous_vote: true,
      results_visibility: 'live',
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-user-2', username: 'jane.doe', firstName: 'Jane', lastName: 'Doe' },
      created_at: now,
    },
    {
      id: 'fake-s4',
      workspace_id: workspaceId,
      title: 'Team offsite location',
      description: null,
      vote_format: 'ranked',
      visibility: 'public',
      status: 'results_released',
      who_can_vote: 'all_members',
      allow_anonymous_vote: false,
      results_visibility: 'after_you_vote',
      start_time: null,
      end_time: null,
      createdBy: { id: 'fake-user-3', username: 'sam.lee', firstName: 'Sam', lastName: 'Lee' },
      created_at: now,
    },
  ]
}

function creatorName(session: VotingSession) {
  if (!session.createdBy) {
    return 'Anonymous'
  }
  const fullName = `${session.createdBy.firstName} ${session.createdBy.lastName}`.trim()
  return fullName || session.createdBy.username
}

function currentUserDisplayName(user: UserSummary | null) {
  if (!user) return 'Guest'
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  return fullName || user.username
}

export function WorkspaceDashboardClient({
  workspaces,
  initialWorkspaceId,
  initialSessions,
  usingFakeSessions,
  currentUser,
}: {
  workspaces: Workspace[]
  initialWorkspaceId: string | null
  initialSessions: VotingSession[]
  usingFakeSessions: boolean
  currentUser: UserSummary | null
}) {
  const router = useRouter()
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId)
  const [sessions, setSessions] = useState(initialSessions)
  const [usingFake, setUsingFake] = useState(usingFakeSessions)
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.push('/')
    router.refresh()
  }

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
  const theme = THEME[selectedWorkspace?.type === 'ff' ? 'ff' : 'standard']

  async function selectWorkspace(workspaceId: string) {
    setSelectedWorkspaceId(workspaceId)
    setLoading(true)
    setTab('active')

    const result = await listSessions(workspaceId)
    setLoading(false)

    if (result.success) {
      setSessions(result.sessions ?? [])
      setUsingFake(false)
    } else {
      setSessions(buildFakeSessions(workspaceId))
      setUsingFake(true)
    }
  }

  const filtered = sessions.filter((session) => {
    if (tab === 'active') return session.status === 'open'
    if (tab === 'drafts') return session.status === 'draft'
    return session.status === 'closed' || session.status === 'results_released'
  })

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <AuraBackground />

      <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-divider bg-background/80 px-4 py-6">
        <Link href="/" className="mb-8 flex items-center px-1">
          <Logo className="h-6 w-auto text-foreground" />
        </Link>

        <nav className="flex flex-col gap-1 text-sm">
          <span className="rounded-lg bg-foreground/10 px-3 py-2 text-foreground">Dashboard</span>
          <Link
            href={selectedWorkspaceId ? `/sessions/create?workspaceId=${selectedWorkspaceId}` : '#'}
            className="rounded-lg px-3 py-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Create a Session
          </Link>
          <Link
            href="/join"
            className="rounded-lg px-3 py-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Join by Code
          </Link>
        </nav>

        <p className="mb-2 mt-8 px-3 text-xs uppercase tracking-wide text-subtle">Workspaces</p>
        <div className="flex flex-col gap-1">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => selectWorkspace(workspace.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                workspace.id === selectedWorkspaceId
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted hover:bg-foreground/5 hover:text-foreground'
              }`}
            >
              {workspace.name}
            </button>
          ))}
          {workspaces.length === 0 && <p className="px-3 text-xs text-subtle">No workspaces yet.</p>}
        </div>

        <Link
          href="/workspaces/create"
          className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted transition hover:border-border-strong hover:text-foreground"
        >
          + New Workspace
        </Link>

        <div className="mt-auto border-t border-divider pt-4">
          <div className="flex items-center gap-2 px-1 pb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-border-strong text-xs font-medium text-foreground">
              {currentUserDisplayName(currentUser).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">{currentUserDisplayName(currentUser)}</p>
              {currentUser && <p className="truncate text-xs text-muted">@{currentUser.username}</p>}
            </div>
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
        {!selectedWorkspace ? (
          <p className="text-sm text-muted">
            You&apos;re not in any workspaces yet.{' '}
            <Link href="/workspaces/create" className="underline">
              Create one
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <>
            {usingFake && (
              <p className="mb-6 inline-block rounded-lg border border-yellow-800 bg-yellow-950/50 px-4 py-2 text-xs text-yellow-400">
                Showing placeholder sessions — listSessions isn&apos;t returning real data for this workspace yet.
              </p>
            )}

            <h1 className="font-heading text-3xl text-foreground">{selectedWorkspace.name}</h1>

            <div className="mt-6 flex gap-6 border-b border-divider text-sm">
              {(['active', 'drafts', 'history'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-1 pb-3 capitalize transition ${
                    tab === t ? theme.tabActive : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {loading ? (
                <p className="py-8 text-sm text-muted">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-sm text-muted">No sessions here yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-divider text-xs uppercase tracking-wide text-subtle">
                      <th className="py-2 font-normal">Title</th>
                      <th className="py-2 font-normal">Status</th>
                      <th className="py-2 font-normal">Created by</th>
                      <th className="py-2 font-normal">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((session) => (
                      <tr key={session.id} className={`border-b border-divider/60 ${theme.rowHover}`}>
                        <td className="py-3">
                          <Link
                            href={`/sessions/${session.id}`}
                            className="text-foreground transition hover:underline"
                          >
                            {session.title}
                          </Link>
                        </td>
                        <td className={`py-3 ${theme.badge[session.status]}`}>{STATUS_LABEL[session.status]}</td>
                        <td className="py-3 text-muted">
                          <span className="flex items-center gap-2">
                            {theme.showAvatars && <span className="h-4 w-4 rounded-full bg-fuchsia-500" />}
                            <span>{creatorName(session)}</span>
                          </span>
                        </td>
                        <td className="py-3 text-muted">{new Date(session.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
