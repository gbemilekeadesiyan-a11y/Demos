'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuraBackground } from '@/components/AuraBackground'
import { castVote, getSessionResults } from '../../_lib/actions'
import type { SessionOption, VotingSession } from '../../_lib/schema'

type ResultRow = { optionId: string; label: string; count: number }
type WorkspaceType = 'standard' | 'ff'

const THEME: Record<
  WorkspaceType,
  {
    accentSelected: string
    accentBorder: string
    barFill: string
    cardClass: string
    showAvatars: boolean
    footerCopy: (count: number) => string
  }
> = {
  standard: {
    accentSelected: 'border-white bg-white text-neutral-950',
    accentBorder: 'border-neutral-800 hover:border-neutral-600',
    barFill: 'bg-neutral-200',
    cardClass: 'border-neutral-800 bg-neutral-900/80',
    showAvatars: false,
    footerCopy: (count) => `${count} vote${count === 1 ? '' : 's'}`,
  },
  ff: {
    accentSelected: 'border-fuchsia-400 bg-fuchsia-500 text-white',
    accentBorder: 'border-fuchsia-900/40 hover:border-fuchsia-500/60',
    barFill: 'bg-gradient-to-r from-fuchsia-500 to-amber-400',
    cardClass: 'border-fuchsia-900/30 bg-neutral-900/60',
    showAvatars: true,
    footerCopy: (count) => `🎉 ${count} ${count === 1 ? 'person has' : 'people have'} weighed in`,
  },
}

const AVATAR_COLORS = ['bg-fuchsia-500', 'bg-amber-400', 'bg-emerald-400', 'bg-sky-400']

export function SessionVotingClient({
  sessionId,
  session,
  options,
  initialHasVoted,
  initialShowResults,
  initialResults,
  initialTotalVotes,
  initialResultsLocked,
  workspaceType,
  usingFakeData,
}: {
  sessionId: string
  session: VotingSession
  options: SessionOption[]
  initialHasVoted: boolean
  initialShowResults: boolean
  initialResults: ResultRow[]
  initialTotalVotes: number
  initialResultsLocked: boolean
  workspaceType: WorkspaceType
  usingFakeData: boolean
}) {
  const theme = THEME[workspaceType]

  const [hasVoted, setHasVoted] = useState(initialHasVoted)
  const [showResults, setShowResults] = useState(initialShowResults)
  const [results, setResults] = useState(initialResults)
  const [totalVotes, setTotalVotes] = useState(initialTotalVotes)
  const [resultsLocked, setResultsLocked] = useState(initialResultsLocked)

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
  const suppressRankedBreakdown = session.vote_format === 'ranked' && session.status === 'open'

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
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 px-4 py-12">
      <AuraBackground />

      <div className="relative mx-auto max-w-lg">
        {usingFakeData && (
          <p className="mb-6 rounded-lg border border-yellow-800 bg-yellow-950/50 px-4 py-2 text-xs text-yellow-400">
            Showing placeholder data — getSessionDetails isn&apos;t returning a real session yet.
          </p>
        )}

        <h1 className="font-heading text-3xl text-white">{session.title}</h1>
        {session.description && <p className="mt-2 text-sm text-neutral-400">{session.description}</p>}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {session.status === 'draft' ? (
          <p className="mt-8 text-sm text-neutral-500">This session hasn&apos;t opened yet.</p>
        ) : !showResults ? (
          <div className="mt-8">
            {session.results_visibility === 'live' && (
              <p className="mb-4 text-xs text-neutral-500">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500 align-middle" />
                {totalVotes} vote{totalVotes === 1 ? '' : 's'} so far
              </p>
            )}
            <div className="flex flex-col gap-2">
              {session.vote_format === 'single' &&
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedId(option.id)}
                    className={`rounded-full border px-4 py-3 text-left text-sm transition ${
                      selectedId === option.id ? theme.accentSelected : `${theme.accentBorder} text-white`
                    }`}
                  >
                    {option.label}
                  </button>
                ))}

              {session.vote_format === 'multiple' &&
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleMultiple(option.id)}
                    className={`rounded-full border px-4 py-3 text-left text-sm transition ${
                      selectedIds.has(option.id) ? theme.accentSelected : `${theme.accentBorder} text-white`
                    }`}
                  >
                    {option.label}
                  </button>
                ))}

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
                      className={`flex cursor-grab items-center gap-3 rounded-lg border px-4 py-3 text-sm text-white ${theme.cardClass}`}
                    >
                      <span className="text-xs text-neutral-500">{index + 1}</span>
                      <span className="flex-1">{option.label}</span>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => moveRanked(index, -1)}
                          aria-label="Move up"
                          className="text-neutral-500 hover:text-white"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRanked(index, 1)}
                          aria-label="Move down"
                          className="text-neutral-500 hover:text-white"
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
              className="mt-6 w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit Vote'}
            </button>
          </div>
        ) : resultsLocked || suppressRankedBreakdown ? (
          <p className="mt-8 text-sm text-neutral-400">
            {totalVotes} vote{totalVotes === 1 ? '' : 's'}
            {resultsLocked
              ? ' · Vote to see results'
              : ' · Full ranked-choice results are revealed after voting closes'}
          </p>
        ) : (
          <div className="mt-8">
            <div className="flex flex-col gap-2">
              {results.map((row, index) => {
                const pct = totalVotes > 0 ? Math.round((row.count / totalVotes) * 100) : 0
                return (
                  <div
                    key={row.optionId}
                    className={`relative overflow-hidden rounded-full border ${theme.cardClass}`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${theme.barFill} opacity-80`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between px-4 py-3 text-sm text-white">
                      <span className="flex items-center gap-2">
                        {row.label}
                        {theme.showAvatars && (
                          <span className="flex -space-x-1">
                            {[0, 1].map((dot) => (
                              <span
                                key={dot}
                                className={`h-4 w-4 rounded-full border border-neutral-950 ${
                                  AVATAR_COLORS[(index + dot) % AVATAR_COLORS.length]
                                }`}
                              />
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="text-neutral-300">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-xs text-neutral-500">{theme.footerCopy(totalVotes)}</p>
          </div>
        )}
      </div>
    </main>
  )
}
