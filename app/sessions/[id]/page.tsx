import { createClient } from '@/lib/supabase/server'
import { getSessionDetails, getSessionResults, listSessionVoters } from '../_lib/actions'
import type { RankedRound, SessionOption, SessionVoter, VotingSession } from '../_lib/schema'
import { SessionVotingClient } from './_components/SessionVotingClient'

type ResultRow = { optionId: string; label: string; count: number }

function buildFakeSession(sessionId: string): VotingSession {
  return {
    id: sessionId,
    workspace_id: 'fake-workspace',
    title: 'Where should we eat lunch tomorrow?',
    description: 'Pick your favorite — voting closes soon.',
    vote_format: 'single',
    visibility: 'public',
    status: 'open',
    who_can_vote: 'all_members',
    allow_anonymous_vote: true,
    results_visibility: 'hidden_until_close',
    results_style: null,
    ballot_secrecy: 'secret',
    start_time: null,
    end_time: null,
    createdBy: { id: 'fake-admin', username: 'you', firstName: 'You', lastName: '' },
    created_at: new Date().toISOString(),
  }
}

function buildFakeOptions(sessionId: string): SessionOption[] {
  return [
    { id: 'fake-o1', session_id: sessionId, label: 'A New Place!', description: null, image_url: null },
    { id: 'fake-o2', session_id: sessionId, label: 'At Office', description: null, image_url: null },
    { id: 'fake-o3', session_id: sessionId, label: 'Regular Place', description: null, image_url: null },
    { id: 'fake-o4', session_id: sessionId, label: 'Any will do', description: null, image_url: null },
  ]
}

function buildFakeResults(options: SessionOption[]): ResultRow[] {
  const counts = [21, 6, 15, 3]
  return options.map((option, i) => ({ optionId: option.id, label: option.label, count: counts[i] ?? 0 }))
}

function buildFakeVoters(options: SessionOption[]): SessionVoter[] {
  const names = [
    { username: 'jane.doe', firstName: 'Jane', lastName: 'Doe' },
    { username: 'sam.lee', firstName: 'Sam', lastName: 'Lee' },
    { username: 'alex.kim', firstName: 'Alex', lastName: 'Kim' },
    { username: 'priya.rao', firstName: 'Priya', lastName: 'Rao' },
    { username: 'jordan.b', firstName: 'Jordan', lastName: 'B' },
  ]
  const now = new Date().toISOString()
  return names.map((name, i) => ({
    user: { id: `fake-voter-${i}`, ...name },
    votedAt: now,
    selections: options[i % options.length] ? [{ optionId: options[i % options.length].id }] : [],
  }))
}

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  let session: VotingSession
  let options: SessionOption[]
  let hasVoted = false
  let usingFakeData = false

  const detailsResult = await getSessionDetails(id)

  if (detailsResult.success && detailsResult.session && detailsResult.options) {
    session = detailsResult.session
    options = detailsResult.options
    hasVoted = detailsResult.hasVoted ?? false
  } else {
    usingFakeData = true
    session = buildFakeSession(id)
    options = buildFakeOptions(id)
  }

  let workspaceType: 'standard' | 'ff' = 'standard'

  if (!usingFakeData) {
    const { data: workspaceRow } = await supabase
      .from('workspaces')
      .select('type')
      .eq('id', session.workspace_id)
      .single()

    if (workspaceRow?.type === 'ff') {
      workspaceType = 'ff'
    }
  }

  const showResults = session.status === 'draft' ? false : hasVoted || session.status !== 'open'

  let results: ResultRow[] = []
  let totalVotes = 0
  let resultsLocked = true
  let rounds: RankedRound[] = []
  let voters: SessionVoter[] = []

  if (showResults) {
    const resultsResult = usingFakeData
      ? { success: false as const }
      : await getSessionResults(id)

    if (resultsResult.success && !usingFakeData) {
      results = resultsResult.results ?? []
      totalVotes = resultsResult.totalVotes ?? 0
      resultsLocked = resultsResult.resultsLocked ?? false
      rounds = resultsResult.rounds ?? []
    } else {
      results = buildFakeResults(options)
      totalVotes = results.reduce((sum, row) => sum + row.count, 0)
      resultsLocked = false
      // Placeholder data has no real elimination history — a single round
      // is enough for the leaderboard to render something sensible.
      rounds = session.vote_format === 'ranked' ? [{ roundNumber: 1, counts: results, eliminated: [] }] : []
    }

    if (!resultsLocked) {
      const votersResult = usingFakeData
        ? { success: false as const }
        : await listSessionVoters(id)

      voters = votersResult.success && !usingFakeData ? (votersResult.voters ?? []) : buildFakeVoters(options)
    }
  }

  return (
    <SessionVotingClient
      sessionId={id}
      session={session}
      options={options}
      initialHasVoted={hasVoted}
      initialShowResults={showResults}
      initialResults={results}
      initialTotalVotes={totalVotes}
      initialResultsLocked={resultsLocked}
      initialRounds={rounds}
      initialVoters={voters}
      workspaceType={workspaceType}
      usingFakeData={usingFakeData}
    />
  )
}
