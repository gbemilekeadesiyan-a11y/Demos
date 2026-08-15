'use client'

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AuraBackground } from '@/components/AuraBackground'
import {
  castVote,
  closeSession,
  getSessionInviteCode,
  getSessionResults,
  listSessionVoters,
  openSession,
  releaseResults,
  sendSessionVoteInvite,
} from '../../_lib/actions'
import type { RankedRound, SessionOption, SessionVoter, VotingSession } from '../../_lib/schema'
import { ResultsDisplay } from './ResultsDisplay'

type ResultRow = { optionId: string; label: string; count: number }
type WorkspaceType = 'standard' | 'ff'

const THEME: Record<
  WorkspaceType,
  {
    accentSelected: string
    accentBorder: string
    cardClass: string
    primaryButton: string
  }
> = {
  standard: {
    accentSelected: 'border-accent bg-accent text-accent-foreground',
    accentBorder: 'border-border hover:border-border-strong',
    cardClass: 'border-border bg-surface/80',
    primaryButton: 'bg-accent text-accent-foreground',
  },
  ff: {
    accentSelected: 'border-fuchsia-400 bg-fuchsia-500 text-white',
    accentBorder: 'border-fuchsia-900/40 hover:border-fuchsia-500/60',
    cardClass: 'border-fuchsia-900/30 bg-surface/60',
    // ff keeps its own bright palette (fuchsia/amber/sky) rather than the
    // site accent — see CLAUDE.md's ff theming rules.
    primaryButton: 'bg-fuchsia-500 text-white',
  },
}

// F&F-only, larger image-forward option card — falls back to a colorful
// gradient block when the option has no image_url. Standard workspaces
// keep the compact pill button below; same component, same click/selection
// behavior, only the visual treatment branches on ff.
function FfOptionCard({
  option,
  selected,
  onClick,
}: {
  option: SessionOption
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block w-full overflow-hidden rounded-2xl border-2 text-left transition ${
        selected ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/50' : 'border-transparent hover:border-fuchsia-400/40'
      }`}
    >
      {option.image_url ? (
        <div className="relative h-40 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- matches the existing <img> usage in WorkspaceDetailClient's QR code, no next/image elsewhere in this codebase */}
          <img src={option.image_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-400" />
      )}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <p className="text-base font-semibold text-white drop-shadow">{option.label}</p>
        {option.description && (
          <p className="mt-0.5 truncate text-xs text-white/80">{option.description}</p>
        )}
      </div>
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500 text-sm text-white">
          ✓
        </span>
      )}
    </button>
  )
}

export function SessionVotingClient({
  sessionId,
  session,
  options,
  initialHasVoted,
  initialShowResults,
  initialResults,
  initialTotalVotes,
  initialResultsLocked,
  initialRounds,
  initialVoters,
  workspaceType,
  usingFakeData,
  isAdmin,
  fill = false,
  suppressPlaceholderBanner = false,
}: {
  sessionId: string
  session: VotingSession
  options: SessionOption[]
  initialHasVoted: boolean
  initialShowResults: boolean
  initialResults: ResultRow[]
  initialTotalVotes: number
  initialResultsLocked: boolean
  initialRounds: RankedRound[]
  initialVoters: SessionVoter[]
  workspaceType: WorkspaceType
  usingFakeData: boolean
  isAdmin: boolean
  // `min-h-screen` (below) is 100vh of the real browser viewport, not the
  // nearest container — correct for an actual /sessions/[id] page, wrong
  // for mounting this inside a small fixed-size preview (e.g. the landing
  // page's carousel), where it would blow past the frame entirely. `fill`
  // switches the root to h-full of whatever box it's given instead.
  fill?: boolean
  // Independent of `usingFakeData` (which also skips the live-results
  // subscription and makes vote submission a local-only no-op — both still
  // apply): the yellow "showing placeholder data" banner is meant for a
  // real page silently falling back to mock data, not for a page that's
  // intentionally, permanently presentational.
  suppressPlaceholderBanner?: boolean
}) {
  const theme = THEME[workspaceType]

  // Tracked separately from `session` (otherwise unchanged) so the
  // draft → open → closed → results_released lifecycle buttons below can
  // update the page immediately after a transition, without a full reload.
  const [status, setStatus] = useState(session.status)
  const [lifecycleLoading, setLifecycleLoading] = useState(false)
  const [lifecycleError, setLifecycleError] = useState<string | null>(null)

  async function handleLifecycleAction() {
    setLifecycleLoading(true)
    setLifecycleError(null)

    const result =
      status === 'draft'
        ? await openSession(sessionId)
        : status === 'open'
          ? await closeSession(sessionId)
          : await releaseResults(sessionId)

    if (!result.success) {
      setLifecycleLoading(false)
      setLifecycleError(result.error ?? 'Could not update this session')
      return
    }

    const nextStatus = status === 'draft' ? 'open' : status === 'open' ? 'closed' : 'results_released'
    setStatus(nextStatus)

    // Closing/releasing can reveal results immediately for an admin who
    // hasn't voted themselves (and so never hit the same reveal in
    // handleSubmitVote below) — refetch and show them rather than leaving
    // the page looking unchanged until a manual reload.
    if (nextStatus !== 'open') {
      const resultsResult = await getSessionResults(sessionId)
      if (resultsResult.success) {
        setResults(resultsResult.results ?? [])
        setTotalVotes(resultsResult.totalVotes ?? 0)
        setResultsLocked(resultsResult.resultsLocked ?? false)
        setRounds(resultsResult.rounds ?? [])

        if (!resultsResult.resultsLocked) {
          const votersResult = await listSessionVoters(sessionId)
          setVoters(votersResult.success ? (votersResult.voters ?? []) : [])
        }
      }
      setShowResults(true)
    }

    setLifecycleLoading(false)
  }

  const [linkCopied, setLinkCopied] = useState(false)

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/sessions/${sessionId}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const canSendVoteInvite = workspaceType === 'ff' && session.who_can_vote === 'public_link' && session.allow_anonymous_vote

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteCodeLink, setInviteCodeLink] = useState<string | null>(null)
  const [inviteCodeLinkCopied, setInviteCodeLinkCopied] = useState(false)

  useEffect(() => {
    if (!isAdmin || usingFakeData || !canSendVoteInvite) return

    getSessionInviteCode(sessionId).then((result) => {
      if (result.success && result.code) {
        setInviteCode(result.code)
        setInviteCodeLink(`${window.location.origin}/sessions/vote?code=${result.code}`)
      }
    })
  }, [sessionId, isAdmin, usingFakeData, canSendVoteInvite])

  function handleCopyInviteCodeLink() {
    if (!inviteCodeLink) return
    navigator.clipboard.writeText(inviteCodeLink)
    setInviteCodeLinkCopied(true)
    setTimeout(() => setInviteCodeLinkCopied(false), 2000)
  }

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)

  async function handleSendInvite(e: FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError(null)
    setInviteSent(false)

    const result = await sendSessionVoteInvite(sessionId, inviteEmail, window.location.origin)

    setInviteLoading(false)

    if (!result.success) {
      setInviteError(result.error ?? 'Could not send invite')
      return
    }

    setInviteSent(true)
    setInviteEmail('')
  }

  const [hasVoted, setHasVoted] = useState(initialHasVoted)
  const [showResults, setShowResults] = useState(initialShowResults)
  const [results, setResults] = useState(initialResults)
  const [totalVotes, setTotalVotes] = useState(initialTotalVotes)
  const [resultsLocked, setResultsLocked] = useState(initialResultsLocked)
  const [rounds, setRounds] = useState(initialRounds)
  const [voters, setVoters] = useState(initialVoters)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rankedOrder, setRankedOrder] = useState<string[]>(options.map((option) => option.id))
  const dragIndex = useRef<number | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live results: only wired up when results_visibility is 'live' — RLS on
  // votes/vote_selections still gates what this caller actually receives,
  // same as a manual getSessionResults call would. See
  // supabase/migrations/007_session_results_realtime.sql for the
  // publication change this depends on.
  useEffect(() => {
    if (usingFakeData || session.results_visibility !== 'live') {
      return
    }

    const supabase = createClient()

    async function refreshResults() {
      const result = await getSessionResults(sessionId)
      if (result.success) {
        setResults(result.results ?? [])
        setTotalVotes(result.totalVotes ?? 0)
        setResultsLocked(result.resultsLocked ?? false)
        setRounds(result.rounds ?? [])

        if (!result.resultsLocked) {
          const votersResult = await listSessionVoters(sessionId)
          setVoters(votersResult.success ? (votersResult.voters ?? []) : [])
        } else {
          setVoters([])
        }
      }
    }

    const channel = supabase
      .channel(`session-results-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'votes', filter: `session_id=eq.${sessionId}` },
        refreshResults
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vote_selections', filter: `session_id=eq.${sessionId}` },
        refreshResults
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, session.results_visibility, usingFakeData])

  function toggleMultiple(optionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(optionId)) {
        next.delete(optionId)
      } else {
        next.add(optionId)
      }
      return next
    })
  }

  function moveRanked(index: number, direction: -1 | 1) {
    setRankedOrder((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return next
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleDrop(index: number) {
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === index) return
    setRankedOrder((current) => {
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(index, 0, moved)
      return next
    })
  }

  function buildSelections(): { optionId: string; rank?: number }[] {
    if (session.vote_format === 'single') {
      return selectedId ? [{ optionId: selectedId }] : []
    }
    if (session.vote_format === 'multiple') {
      return [...selectedIds].map((optionId) => ({ optionId }))
    }
    return rankedOrder.map((optionId, index) => ({ optionId, rank: index + 1 }))
  }

  const canSubmit =
    session.vote_format === 'single'
      ? selectedId !== null
      : session.vote_format === 'multiple'
        ? selectedIds.size > 0
        : true

  // Per demos-system-design.md § 8.4: never show a live IRV leaderboard —
  // standings can flip entirely as ballots arrive and eliminations happen,
  // which can mislead voters mid-poll. Vote count only until the session
  // closes, regardless of resultsLocked/live settings.
  const suppressRankedBreakdown = session.vote_format === 'ranked' && status === 'open'

  async function handleSubmitVote() {
    setError(null)
    const selections = buildSelections()

    if (selections.length === 0) {
      setError('Select at least one option.')
      return
    }

    setSubmitting(true)

    if (usingFakeData) {
      setResults((current) =>
        current.map((row) =>
          selections.some((selection) => selection.optionId === row.optionId)
            ? { ...row, count: row.count + 1 }
            : row
        )
      )
      setTotalVotes((current) => current + 1)
      setHasVoted(true)
      setShowResults(true)
      setSubmitting(false)
      return
    }

    const voteResult = await castVote(sessionId, selections)

    if (!voteResult.success) {
      setSubmitting(false)
      setError(voteResult.error ?? 'Could not record your vote')
      return
    }

    const resultsResult = await getSessionResults(sessionId)
    setSubmitting(false)
    setHasVoted(true)
    setShowResults(true)

    if (resultsResult.success) {
      setResults(resultsResult.results ?? [])
      setTotalVotes(resultsResult.totalVotes ?? 0)
      setResultsLocked(resultsResult.resultsLocked ?? false)
      setRounds(resultsResult.rounds ?? [])

      if (!resultsResult.resultsLocked) {
        const votersResult = await listSessionVoters(sessionId)
        setVoters(votersResult.success ? (votersResult.voters ?? []) : [])
      }
    }
  }

  return (
    <main
      className={`relative bg-background px-4 ${
        fill
          ? 'h-full overflow-y-auto overflow-x-hidden py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'min-h-screen overflow-hidden py-12'
      }`}
    >
      <AuraBackground variant={workspaceType === 'ff' ? 'ff' : 'default'} />

      <div className="relative mx-auto max-w-lg">
        <Link
          href={workspaceType === 'ff' ? '/family' : '/workspaces'}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← Back to dashboard
        </Link>

        {usingFakeData && !suppressPlaceholderBanner && (
          <p className="mb-6 mt-4 rounded-lg border border-yellow-800 bg-yellow-950/50 px-4 py-2 text-xs text-yellow-400">
            Showing placeholder data — getSessionDetails isn&apos;t returning a real session yet.
          </p>
        )}

        <h1 className="mt-4 font-heading text-3xl text-foreground">{session.title}</h1>
        {session.description && <p className="mt-2 text-sm text-muted">{session.description}</p>}

        {isAdmin && !usingFakeData && status !== 'results_released' && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-strong bg-surface/40 px-4 py-3">
            <p className="text-xs text-muted">
              {status === 'draft' && "This session is a draft — open it so people can vote."}
              {status === 'open' && 'Voting is open.'}
              {status === 'closed' && 'Voting is closed — release results when ready.'}
            </p>
            <button
              type="button"
              onClick={handleLifecycleAction}
              disabled={lifecycleLoading}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition hover:opacity-90 disabled:opacity-50 ${theme.primaryButton}`}
            >
              {lifecycleLoading
                ? 'Updating…'
                : status === 'draft'
                  ? 'Open Session'
                  : status === 'open'
                    ? 'Close Voting'
                    : 'Release Results'}
            </button>
          </div>
        )}
        {lifecycleError && <p className="mt-2 text-xs text-red-400">{lifecycleError}</p>}

        {isAdmin && !usingFakeData && (
          <div className="mt-4 rounded-lg border border-dashed border-border-strong bg-surface/40 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">Share this session</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
              >
                {linkCopied ? 'Copied!' : 'Copy Session Link'}
              </button>
            </div>

            {canSendVoteInvite ? (
              <>
                {inviteCodeLink && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={inviteCodeLink}
                        onFocus={(e) => e.target.select()}
                        className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyInviteCodeLink}
                        className="shrink-0 rounded-full border border-border px-3 py-2 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
                      >
                        {inviteCodeLinkCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-xs text-muted">
                      Or enter this code at /join: <span className="font-medium text-foreground">{inviteCode}</span>
                    </p>
                  </div>
                )}
                <form onSubmit={handleSendInvite} className="mt-3 flex items-center gap-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground outline-none focus:border-border-strong"
                />
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition hover:opacity-90 disabled:opacity-50 ${theme.primaryButton}`}
                >
                  {inviteLoading ? 'Sending…' : 'Send Voting Invite'}
                </button>
                </form>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted">
                Voting invite emails (vote without an account) are only available for F&amp;F sessions set to public
                link with anonymous voting enabled.
              </p>
            )}

            {inviteSent && <p className="mt-2 text-xs text-emerald-400">Invite sent.</p>}
            {inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {status === 'draft' ? (
          <p className="mt-8 text-sm text-muted">This session hasn&apos;t opened yet.</p>
        ) : !showResults ? (
          <div className="mt-8">
            {session.results_visibility === 'live' && (
              <p className="mb-4 text-xs text-muted">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                {totalVotes} vote{totalVotes === 1 ? '' : 's'} so far
              </p>
            )}
            <div className={`flex flex-col ${workspaceType === 'ff' ? 'gap-3' : 'gap-2'}`}>
              {session.vote_format === 'single' &&
                options.map((option) =>
                  workspaceType === 'ff' ? (
                    <FfOptionCard
                      key={option.id}
                      option={option}
                      selected={selectedId === option.id}
                      onClick={() => setSelectedId(option.id)}
                    />
                  ) : (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedId(option.id)}
                      className={`rounded-full border px-4 py-3 text-left text-sm transition ${
                        selectedId === option.id ? theme.accentSelected : `${theme.accentBorder} text-foreground`
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                )}

              {session.vote_format === 'multiple' &&
                options.map((option) =>
                  workspaceType === 'ff' ? (
                    <FfOptionCard
                      key={option.id}
                      option={option}
                      selected={selectedIds.has(option.id)}
                      onClick={() => toggleMultiple(option.id)}
                    />
                  ) : (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleMultiple(option.id)}
                      className={`rounded-full border px-4 py-3 text-left text-sm transition ${
                        selectedIds.has(option.id) ? theme.accentSelected : `${theme.accentBorder} text-foreground`
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                )}

              {session.vote_format === 'ranked' &&
                rankedOrder.map((optionId, index) => {
                  const option = options.find((o) => o.id === optionId)
                  if (!option) return null
                  return (
                    <div
                      key={optionId}
                      draggable
                      onDragStart={() => {
                        dragIndex.current = index
                      }}
                      onDragOver={(e: DragEvent<HTMLDivElement>) => e.preventDefault()}
                      onDrop={() => handleDrop(index)}
                      className={`flex cursor-grab items-center gap-3 rounded-lg border px-4 py-3 text-sm text-foreground ${theme.cardClass}`}
                    >
                      <span className="text-xs text-muted">{index + 1}</span>
                      {workspaceType === 'ff' &&
                        (option.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- matches the existing <img> usage in WorkspaceDetailClient's QR code, no next/image elsewhere in this codebase
                          <img
                            src={option.image_url}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-400" />
                        ))}
                      <span className="flex-1">{option.label}</span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveRanked(index, -1)}
                          aria-label="Move up"
                          className="text-muted hover:text-foreground"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRanked(index, 1)}
                          aria-label="Move down"
                          className="text-muted hover:text-foreground"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>

            <button
              type="button"
              onClick={handleSubmitVote}
              disabled={!canSubmit || submitting}
              className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 ${theme.primaryButton}`}
            >
              {submitting ? 'Submitting…' : 'Submit Vote'}
            </button>
          </div>
        ) : (
          <ResultsDisplay
            session={session}
            results={results}
            totalVotes={totalVotes}
            resultsLocked={resultsLocked}
            rounds={rounds}
            voters={voters}
            suppressRankedBreakdown={suppressRankedBreakdown}
          />
        )}
      </div>
    </main>
  )
}
