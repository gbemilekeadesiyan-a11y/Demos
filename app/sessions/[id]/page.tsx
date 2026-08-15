import { createClient } from '@/lib/supabase/server'
import { ErrorState } from '@/components/ErrorState'
import { getSessionDetails, getSessionResults, listSessionVoters } from '../_lib/actions'
import type { RankedRound, SessionOption, SessionVoter, VotingSession } from '../_lib/schema'
import { SessionVotingClient } from './_components/SessionVotingClient'

type ResultRow = { optionId: string; label: string; count: number }

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const detailsResult = await getSessionDetails(id)

  if (!detailsResult.success || !detailsResult.session || !detailsResult.options) {
    return <ErrorState message="Couldn't load this session." backHref="/" backLabel="Back to home" />
  }

  const session: VotingSession = detailsResult.session
  const options: SessionOption[] = detailsResult.options
  const hasVoted = detailsResult.hasVoted ?? false

  let workspaceType: 'standard' | 'ff' = 'standard'
  let isAdmin = false
  let isAnonymousVoter = false

  const { data: workspaceRow } = await supabase
    .from('workspaces')
    .select('type')
    .eq('id', session.workspace_id)
    .single()

  if (workspaceRow?.type === 'ff') {
    workspaceType = 'ff'
  }

  // Gates the draft→open→closed→results_released lifecycle controls in
  // SessionVotingClient — without this, a session created via
  // createVotingSession (which defaults to 'draft') has no way to ever
  // become votable from the UI.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  isAnonymousVoter = user?.is_anonymous === true

  if (user) {
    const { data: membership } = await supabase
      .from('workspace_memberships')
      .select('role')
      .eq('workspace_id', session.workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    isAdmin = membership?.role === 'admin'
  }

  const showResults = session.status === 'draft' ? false : hasVoted || session.status !== 'open'

  let results: ResultRow[] = []
  let totalVotes = 0
  let resultsLocked = true
  let rounds: RankedRound[] = []
  let voters: SessionVoter[] = []

  if (showResults) {
    const resultsResult = await getSessionResults(id)

    if (resultsResult.success) {
      results = resultsResult.results ?? []
      totalVotes = resultsResult.totalVotes ?? 0
      resultsLocked = resultsResult.resultsLocked ?? false
      rounds = resultsResult.rounds ?? []
    } else {
      // Results failed to load — an empty/zero state, not fabricated
      // numbers. resultsLocked: false so this reads as "no results" rather
      // than "vote to see results" (which would misrepresent hasVoted).
      results = []
      totalVotes = 0
      resultsLocked = false
      rounds = []
    }

    if (!resultsLocked) {
      const votersResult = await listSessionVoters(id)
      voters = votersResult.success ? (votersResult.voters ?? []) : []
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
      usingFakeData={false}
      isAdmin={isAdmin}
      isAnonymousVoter={isAnonymousVoter}
    />
  )
}
