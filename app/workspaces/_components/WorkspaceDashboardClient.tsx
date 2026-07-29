'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
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
    tabActive: 'border-white text-white',
    rowHover: 'hover:bg-neutral-900/60',
    badge: {
      draft: 'text-neutral-400',
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
      draft: 'text-neutral-400',
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

export function WorkspaceDashboardClient({
  workspaces,
  initialWorkspaceId,
  initialSessions,
  usingFakeSessions,
}: {
  workspaces: Workspace[]
  initialWorkspaceId: string | null
  initialSessions: VotingSession[]
  usingFakeSessions: boolean
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(initialWorkspaceId)
  const [sessions, setSessions] = useState(initialSessions)
  const [usingFake, setUsingFake] = useState(usingFakeSessions)
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)

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
    <div className="relative flex min-h-screen overflow-hidden bg-neutral-950">
      <AuraBackground />

      <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-neutral-900 bg-neutral-950/80 px-4 py-6">
        <div className="mb-8 flex items-center gap-2 px-1">
          <Logo className="h-5 w-auto text-white" />
          <span className="font-heading text-lg text-white">dēmos</span>
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          <span className="rounded-lg bg-white/10 px-3 py-2 text-white">Dashboard</span>
          <Link
            href={selectedWorkspaceId ? `/sessions/create?workspaceId=${selectedWorkspaceId}` : '#'}
            className="rounded-lg px-3 py-2 text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            Create a Session
          </Link>
          <Link
            href="/join"
            className="rounded-lg px-3 py-2 text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            Join by Code
          </Link>
        </nav>

        <p className="mb-2 mt-8 px-3 text-xs uppercase tracking-wide text-neutral-600">Workspaces</p>
        <div className="flex flex-col gap-1">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => selectWorkspace(workspace.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                workspace.id === selectedWorkspaceId
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {workspace.name}
            </button>
          ))}
          {workspaces.length === 0 && <p className="px-3 text-xs text-neutral-600">No workspaces yet.</p>}
        </div>

        <Link
          href="/workspaces/create"
          className="mt-4 rounded-lg border border-dashed border-neutral-800 px-3 py-2 text-center text-xs text-neutral-500 transition hover:border-neutral-600 hover:text-neutral-300"
        >
          + New Workspace
        </Link>
      </aside>

      <main className="relative z-10 flex-1 px-8 py-10">
        {!selectedWorkspace ? (
          <p className="text-sm text-neutral-400">
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

            <h1 className="font-heading text-3xl text-white">{selectedWorkspace.name}</h1>

            <div className="mt-6 flex gap-6 border-b border-neutral-900 text-sm">
              {(['active', 'drafts', 'history'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-1 pb-3 capitalize transition ${
                    tab === t ? theme.tabActive : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {loading ? (
                <p className="py-8 text-sm text-neutral-500">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-sm text-neutral-500">No sessions here yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-900 text-xs uppercase tracking-wide text-neutral-600">
                      <th className="py-2 font-normal">Title</th>
                      <th className="py-2 font-normal">Status</th>
                      <th className="py-2 font-normal">Created by</th>
                      <th className="py-2 font-normal">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((session) => (
                      <tr key={session.id} className={`border-b border-neutral-900/60 ${theme.rowHover}`}>
                        <td className="py-3">
                          <Link href={`/sessions/${session.id}`} className="text-white transition hover:underline">
                            {session.title}
                          </Link>
                        </td>
                        <td className={`py-3 ${theme.badge[session.status]}`}>{STATUS_LABEL[session.status]}</td>
                        <td className="py-3 text-neutral-400">
                          <span className="flex items-center gap-2">
                            {theme.showAvatars && <span className="h-4 w-4 rounded-full bg-fuchsia-500" />}
                            <span>{creatorName(session)}</span>
                          </span>
                        </td>
                        <td className="py-3 text-neutral-500">{new Date(session.created_at).toLocaleDateString()}</td>
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
