'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { SwitchSurfaceControl } from '@/components/SwitchSurfaceControl'
import { signOut } from '@/app/(auth)/_lib/actions'
import type { UserSummary } from '@/app/(auth)/_lib/schema'
import { listSessions, listSessionVoters } from '../../sessions/_lib/actions'
import type { SessionVoter, VotingSession } from '../../sessions/_lib/schema'
import { NotificationBell } from '../../notifications/_components/NotificationBell'
import type { Notification } from '../../notifications/_lib/schema'
import type { Workspace } from '../../workspaces/_lib/schema'

type Tab = 'active' | 'drafts' | 'history'

const TAB_LABEL: Record<Tab, string> = { active: 'Active Polls', drafts: 'Drafts', history: 'Past Results' }

const STATUS_LABEL: Record<VotingSession['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  results_released: 'Results released',
}

const CARD_ACCENTS = [
  'from-fuchsia-500 to-violet-500',
  'from-sky-400 to-fuchsia-500',
  'from-amber-400 to-fuchsia-500',
  'from-emerald-400 to-sky-500',
]

function buildFakeSessions(groupId: string): VotingSession[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'fake-s1',
      workspace_id: groupId,
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
      workspace_id: groupId,
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

function greetingPhrase(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
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

function voterName(voter: SessionVoter) {
  if (!voter.user) return 'Anonymous'
  const fullName = `${voter.user.firstName} ${voter.user.lastName}`.trim()
  return fullName || voter.user.username
}

function voterInitial(voter: SessionVoter) {
  return voterName(voter).charAt(0).toUpperCase()
}

export function FamilyDashboardClient({
  groups,
  initialGroupId,
  initialSessions,
  usingFakeSessions,
  currentUser,
  currentUserId,
  initialNotifications,
  canSwitchSurface,
}: {
  groups: Workspace[]
  initialGroupId: string | null
  initialSessions: VotingSession[]
  usingFakeSessions: boolean
  currentUser: UserSummary | null
  currentUserId: string | null
  initialNotifications: Notification[]
  canSwitchSurface: boolean
}) {
  const router = useRouter()
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId)
  const [sessions, setSessions] = useState(initialSessions)
  const [usingFake, setUsingFake] = useState(usingFakeSessions)
  const [tab, setTab] = useState<Tab>('active')
  const [loading, setLoading] = useState(false)
  const [votersBySession, setVotersBySession] = useState<Map<string, SessionVoter[]>>(new Map())

  async function handleSignOut() {
    await signOut()
    router.push('/')
    router.refresh()
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null

  async function selectGroup(groupId: string) {
    setSelectedGroupId(groupId)
    setLoading(true)
    setTab('active')

    const result = await listSessions(groupId)
    setLoading(false)

    if (result.success) {
      setSessions(result.sessions ?? [])
      setUsingFake(false)
    } else {
      setSessions(buildFakeSessions(groupId))
      setUsingFake(true)
    }
  }

  const filtered = sessions.filter((session) => {
    if (tab === 'active') return session.status === 'open'
    if (tab === 'drafts') return session.status === 'draft'
    return session.status === 'closed' || session.status === 'results_released'
  })

  const filteredIds = filtered.map((session) => session.id).join(',')

  // Real participation avatars — see the same fetch in
  // WorkspaceDashboardClient (app/workspaces/_components), skipped for
  // placeholder/fake sessions whose ids don't exist in the database.
  useEffect(() => {
    if (usingFake || filtered.length === 0) {
      setVotersBySession(new Map())
      return
    }

    let cancelled = false

    async function loadVoters() {
      const entries = await Promise.all(
        filtered.map(async (session) => {
          const result = await listSessionVoters(session.id)
          return [session.id, result.success ? (result.voters ?? []) : []] as const
        })
      )
      if (!cancelled) {
        setVotersBySession(new Map(entries))
      }
    }

    loadVoters()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filteredIds is a stable proxy for filtered's contents, avoiding a re-fetch loop from the new array identity `.filter()` produces every render
  }, [filteredIds, usingFake])

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <AuraBackground />

      <aside className="relative z-10 flex w-60 shrink-0 flex-col border-r border-divider bg-background/80 px-4 py-6">
        <Link
          href="/"
          className="mb-4 flex items-center gap-1.5 px-1 text-xs text-muted transition hover:text-fuchsia-300"
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
          <span className="rounded-lg bg-fuchsia-500/10 px-3 py-2 text-fuchsia-300">Dashboard</span>
          <Link
            href={selectedGroupId ? `/sessions/create?workspaceId=${selectedGroupId}&workspaceType=ff` : '#'}
            className="rounded-lg px-3 py-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Create a Poll
          </Link>
          <Link
            href="/join"
            className="rounded-lg px-3 py-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
          >
            Join by Code
          </Link>
        </nav>

        <p className="mb-2 mt-8 px-3 text-xs uppercase tracking-wide text-subtle">Groups</p>
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => selectGroup(group.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                group.id === selectedGroupId
                  ? 'bg-fuchsia-500/10 text-fuchsia-300'
                  : 'text-muted hover:bg-foreground/5 hover:text-foreground'
              }`}
            >
              {group.name}
            </button>
          ))}
          {groups.length === 0 && <p className="px-3 text-xs text-subtle">No groups yet.</p>}
        </div>

        <Link
          href="/family/create"
          className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-center text-xs text-muted transition hover:border-fuchsia-400 hover:text-fuchsia-300"
        >
          + New Group
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
        {canSwitchSurface && (
          <div className="mb-6 flex justify-end">
            <SwitchSurfaceControl current="ff" />
          </div>
        )}

        {!selectedGroup ? (
          <p className="text-sm text-muted">
            You&apos;re not in any groups yet.{' '}
            <Link href="/family/create" className="underline">
              Create one
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <>
            {usingFake && (
              <p className="mb-6 inline-block rounded-lg border border-yellow-800 bg-yellow-950/50 px-4 py-2 text-xs text-yellow-400">
                Showing placeholder polls — listSessions isn&apos;t returning real data for this group yet.
              </p>
            )}

            <p className="text-sm text-muted">
              {greetingPhrase()}, {currentUser?.firstName?.trim() || 'there'}!
            </p>
            <h1 className="font-heading text-3xl text-foreground">{selectedGroup.name}</h1>

            <div className="mt-6 flex gap-6 border-b border-divider text-sm">
              {(['active', 'drafts', 'history'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-1 pb-3 transition ${
                    tab === t
                      ? 'border-fuchsia-400 text-fuchsia-300'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  {TAB_LABEL[t]}
                </button>
              ))}
            </div>

            <div className="mt-4">
              {loading ? (
                <p className="py-8 text-sm text-muted">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-sm text-muted">No polls here yet.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {filtered.map((session, i) => (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}`}
                      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl ${
                        CARD_ACCENTS[i % CARD_ACCENTS.length]
                      }`}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                        {STATUS_LABEL[session.status]}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold leading-snug">{session.title}</h3>
                      <p className="mt-4 text-xs text-white/70">
                        {new Date(session.created_at).toLocaleDateString()} · {creatorName(session)}
                      </p>
                      {/* Real participation from listSessionVoters — who
                          voted, never what they chose (that's gated by
                          ballot_secrecy on the session's own results page,
                          not shown here at all). */}
                      {(() => {
                        const voters = votersBySession.get(session.id) ?? []
                        if (voters.length === 0) return null
                        const visible = voters.slice(0, 3)
                        const overflow = voters.length - visible.length
                        return (
                          <div className="mt-4 flex items-center gap-2">
                            <div className="flex -space-x-2">
                              {visible.map((voter, vi) => (
                                <span
                                  key={voter.user?.id ?? `anon-${vi}`}
                                  title={voterName(voter)}
                                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-[11px] font-semibold text-white"
                                >
                                  {voterInitial(voter)}
                                </span>
                              ))}
                              {overflow > 0 && (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 text-[11px] font-medium text-white">
                                  +{overflow}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-white/70">{voters.length} voted</span>
                          </div>
                        )
                      })()}
                    </Link>
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
