'use server'

import { createClient } from '../../../lib/supabase/server'
import type { UserSummary } from '../../(auth)/_lib/schema'
import type { RankedRound, SessionOption, SessionVoter, VotingSession } from './schema'
import { tallyRankedChoice, tallySimpleChoice } from './tally'

type ProfileRow = { id: string; username: string; first_name: string; last_name: string }

// One batched profiles lookup for however many creator ids are in the
// result set — not a per-row round trip. PostgREST can't auto-embed
// profiles here: voting_sessions.created_by FKs to auth.users, not
// public.profiles, and auth.users isn't exposed via the API, so there's no
// declared relationship for .select() to embed through.
async function fetchUserSummaries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: (string | null | undefined)[]
): Promise<Map<string, UserSummary>> {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  const map = new Map<string, UserSummary>()

  if (uniqueIds.length === 0) {
    return map
  }

  const { data } = await supabase
    .from('profiles')
    .select('id, username, first_name, last_name')
    .in('id', uniqueIds)

  for (const profile of (data ?? []) as ProfileRow[]) {
    map.set(profile.id, {
      id: profile.id,
      username: profile.username,
      firstName: profile.first_name,
      lastName: profile.last_name,
    })
  }

  return map
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toVotingSession(row: any, profiles: Map<string, UserSummary>): VotingSession {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    title: row.title,
    description: row.description,
    vote_format: row.vote_format,
    visibility: row.visibility,
    status: row.status,
    who_can_vote: row.who_can_vote,
    allow_anonymous_vote: row.allow_anonymous_vote,
    results_visibility: row.results_visibility,
    results_style: row.results_style,
    ballot_secrecy: row.ballot_secrecy,
    start_time: row.start_time,
    end_time: row.end_time,
    createdBy: profiles.get(row.created_by) ?? null,
    created_at: row.created_at,
  }
}

// Mirrors the voting_sessions insert policy in
// supabase/migrations/019_member_session_creation.sql, purely so the create
// page (app/sessions/create/page.tsx) can show a clear "you can't do this"
// message up front instead of letting a non-admin fill out the whole form
// and hit a raw Postgres RLS error at submit time. RLS remains the actual
// enforcement boundary — this is UX only.
export async function canCreateSession(workspaceId: string): Promise<{
  success: boolean
  error?: string
  allowed?: boolean
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('type, settings')
    .eq('id', workspaceId)
    .single()

  if (workspaceError || !workspace) {
    return { success: false, error: workspaceError?.message ?? 'Workspace not found' }
  }

  const { data: membership } = await supabase
    .from('workspace_memberships')
    .select('role, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle()

  const isActiveAdmin = membership?.status === 'active' && membership.role === 'admin'
  const membersCanCreate =
    workspace.type === 'ff' &&
    Boolean((workspace.settings as Record<string, unknown> | null)?.membersCanCreateSessions)

  const allowed = isActiveAdmin || (membersCanCreate && membership?.status === 'active')

  return { success: true, allowed }
}

export async function createVotingSession(
  workspaceId: string,
  formData: {
    title: string
    description?: string
    voteFormat: 'single' | 'multiple' | 'ranked'
    visibility: 'public' | 'private'
    whoCanVote: 'all_members' | 'invited_list' | 'public_link' | 'departments'
    allowAnonymousVote: boolean
    resultsVisibility: 'hidden_until_close' | 'live' | 'after_you_vote'
    ballotSecrecy?: 'secret' | 'open'
    startTime?: string
    endTime?: string
  }
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  let ballotSecrecy = formData.ballotSecrecy

  if (!ballotSecrecy) {
    // Default by workspace type, per supabase/migrations/014_ballot_secrecy.sql
    // — secret for standard workspaces, open for ff (which already can't be
    // private/invited_list at all — see enforce_ff_workspace_session_visibility
    // in 011_ff_workspaces.sql). Only used when the caller doesn't pass an
    // explicit override.
    const { data: workspace } = await supabase.from('workspaces').select('type').eq('id', workspaceId).single()
    ballotSecrecy = workspace?.type === 'ff' ? 'open' : 'secret'
  }

  // TEMP DIAGNOSTIC — remove after debugging the RLS violation
  const { data: rpcCheck, error: rpcError } = await supabase.rpc('is_workspace_admin', {
    target_workspace_id: workspaceId,
  })
  console.log('[DIAG] user.id =', user.id)
  console.log('[DIAG] workspaceId =', workspaceId)
  console.log('[DIAG] is_workspace_admin RPC result =', rpcCheck, 'error =', rpcError)
  // END TEMP DIAGNOSTIC

  // RLS requires the caller to be an active admin of workspaceId — see
  // supabase/migrations/005_voting_sessions.sql.
  const { data, error } = await supabase
    .from('voting_sessions')
    .insert({
      workspace_id: workspaceId,
      title: formData.title,
      description: formData.description ?? null,
      vote_format: formData.voteFormat,
      visibility: formData.visibility,
      who_can_vote: formData.whoCanVote,
      allow_anonymous_vote: formData.allowAnonymousVote,
      results_visibility: formData.resultsVisibility,
      ballot_secrecy: ballotSecrecy,
      start_time: formData.startTime ?? null,
      end_time: formData.endTime ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, sessionId: data.id }
}

export async function addSessionOption(
  sessionId: string,
  formData: { label: string; description?: string; imageUrl?: string }
): Promise<{ success: boolean; error?: string; optionId?: string }> {
  const supabase = await createClient()

  // Append to the end: one more than the current highest display_order for
  // this session (0 if it has none yet). See supabase/migrations/005_voting_sessions.sql.
  const { data: lastOption, error: lastOptionError } = await supabase
    .from('session_options')
    .select('display_order')
    .eq('session_id', sessionId)
    .order('display_order', { ascending: false })
    .limit(1)

  if (lastOptionError) {
    return { success: false, error: lastOptionError.message }
  }

  const nextDisplayOrder = lastOption && lastOption.length > 0 ? lastOption[0].display_order + 1 : 0

  const { data, error } = await supabase
    .from('session_options')
    .insert({
      session_id: sessionId,
      label: formData.label,
      description: formData.description ?? null,
      image_url: formData.imageUrl ?? null,
      display_order: nextDisplayOrder,
    })
    .select('id')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, optionId: data.id }
}

// Either a specific user or a department (workspace_groups.id) — never
// both, matching the session_access_grants_target_check constraint in
// supabase/migrations/018_departments.sql. A department grant resolves at
// access-check time through workspace_group_members, not by expanding to
// individual user_id rows here.
export async function grantSessionAccess(
  sessionId: string,
  target: { userId: string } | { departmentId: string }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.from('session_access_grants').insert({
    session_id: sessionId,
    user_id: 'userId' in target ? target.userId : null,
    group_id: 'departmentId' in target ? target.departmentId : null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function listSessionAccessGrants(sessionId: string): Promise<{
  success: boolean
  error?: string
  // A row has either `user` set (departmentId null) or `departmentId` set
  // (user null) — never both, mirroring grantSessionAccess's input shape.
  grants?: { id: string; user: UserSummary | null; departmentId: string | null; createdAt: string }[]
}> {
  const supabase = await createClient()

  // RLS ("Grantees and admins can view session access grants") limits this
  // to the session's workspace admins plus each grantee seeing their own row.
  const { data, error } = await supabase
    .from('session_access_grants')
    .select('id, user_id, group_id, created_at')
    .eq('session_id', sessionId)

  if (error) {
    return { success: false, error: error.message }
  }

  const rows = data ?? []
  const profiles = await fetchUserSummaries(
    supabase,
    rows.map((row) => row.user_id)
  )

  return {
    success: true,
    grants: rows.map((row) => ({
      id: row.id,
      user: row.user_id ? (profiles.get(row.user_id) ?? null) : null,
      departmentId: row.group_id,
      createdAt: row.created_at,
    })),
  }
}

async function transitionSessionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  from: 'draft' | 'open' | 'closed',
  to: 'open' | 'closed' | 'results_released'
): Promise<{ success: boolean; error?: string }> {
  const { data: session, error: sessionError } = await supabase
    .from('voting_sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return { success: false, error: sessionError?.message ?? 'Session not found' }
  }

  if (session.status !== from) {
    return { success: false, error: `Cannot move to "${to}" from "${session.status}"` }
  }

  const { error: updateError } = await supabase
    .from('voting_sessions')
    .update({ status: to })
    .eq('id', sessionId)
    .eq('status', from)
    .select()
    .single()

  if (updateError) {
    // The eq('status', from) guard means 0 rows matched — status changed
    // between the check above and this update (race), not a query error.
    return { success: false, error: 'Session status changed before this could complete — please retry' }
  }

  return { success: true }
}

export async function openSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  return transitionSessionStatus(supabase, sessionId, 'draft', 'open')
}

export async function closeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  return transitionSessionStatus(supabase, sessionId, 'open', 'closed')
}

export async function releaseResults(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  return transitionSessionStatus(supabase, sessionId, 'closed', 'results_released')
}

export async function castVote(
  sessionId: string,
  selections: { optionId: string; rank?: number }[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Validation, the vote-envelope insert, and the vote_selections insert
  // all happen atomically in cast_vote() — see
  // supabase/migrations/005_voting_sessions.sql.
  const { data, error } = await supabase.rpc('cast_vote', {
    p_session_id: sessionId,
    p_selections: selections.map((selection) => ({
      optionId: selection.optionId,
      rank: selection.rank ?? null,
    })),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as { success: boolean; error?: string }

  if (!result.success) {
    return { success: false, error: result.error ?? 'Could not record your vote' }
  }

  return { success: true }
}

export async function listSessions(
  workspaceId: string,
  filter?: { status?: 'draft' | 'open' | 'closed' | 'results_released'; createdByMe?: boolean }
): Promise<{ success: boolean; error?: string; sessions?: VotingSession[] }> {
  const supabase = await createClient()

  let query = supabase.from('voting_sessions').select('*').eq('workspace_id', workspaceId)

  if (filter?.status) {
    query = query.eq('status', filter.status)
  }

  if (filter?.createdByMe) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    query = query.eq('created_by', user.id)
  }

  // RLS (can_access_session) filters out sessions the caller isn't
  // eligible to see, on top of the explicit filters above.
  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const rows = data ?? []
  const profiles = await fetchUserSummaries(
    supabase,
    rows.map((row) => row.created_by)
  )

  return { success: true, sessions: rows.map((row) => toVotingSession(row, profiles)) }
}

export async function getSessionDetails(sessionId: string): Promise<{
  success: boolean
  error?: string
  session?: VotingSession
  options?: SessionOption[]
  hasVoted?: boolean
}> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('voting_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return { success: false, error: sessionError?.message ?? 'Session not found' }
  }

  const profiles = await fetchUserSummaries(supabase, [session.created_by])
  const sessionWithCreator = toVotingSession(session, profiles)

  const { data: options, error: optionsError } = await supabase
    .from('session_options')
    .select('id, session_id, label, description, image_url')
    .eq('session_id', sessionId)
    .order('display_order')

  if (optionsError) {
    return { success: false, error: optionsError.message }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let hasVoted = false

  if (user) {
    const { count } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('user_id', user.id)

    hasVoted = Boolean(count)
  }

  return {
    success: true,
    session: sessionWithCreator,
    options: (options ?? []) as SessionOption[],
    hasVoted,
  }
}

export async function getSessionResults(sessionId: string): Promise<{
  success: boolean
  error?: string
  results?: { optionId: string; label: string; count: number }[]
  totalVotes?: number
  resultsLocked?: boolean
  rounds?: RankedRound[]
}> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('voting_sessions')
    .select('vote_format, ballot_secrecy')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return { success: false, error: sessionError?.message ?? 'Session not found' }
  }

  // Mirrors the results_visibility rule enforced by RLS (see
  // can_view_session_results in supabase/migrations/005_voting_sessions.sql)
  // so we can tell the caller "locked" rather than just handing back an
  // empty result set indistinguishable from "no votes yet".
  const { data: canViewResults, error: canViewError } = await supabase.rpc('can_view_session_results', {
    target_session_id: sessionId,
  })

  if (canViewError) {
    return { success: false, error: canViewError.message }
  }

  if (!canViewResults) {
    // See supabase/migrations/006_session_vote_count.sql — a plain count on
    // `votes` here would be RLS-limited to the caller's own vote, not the
    // true total.
    const { data: voteCount, error: voteCountError } = await supabase.rpc('count_session_votes', {
      target_session_id: sessionId,
    })

    if (voteCountError) {
      return { success: false, error: voteCountError.message }
    }

    return { success: true, results: [], totalVotes: voteCount ?? 0, resultsLocked: true }
  }

  const { data: options, error: optionsError } = await supabase
    .from('session_options')
    .select('id, label')
    .eq('session_id', sessionId)
    .order('display_order')

  if (optionsError) {
    return { success: false, error: optionsError.message }
  }

  let selectionRows: { option_id: string; rank: number | null; vote_id: string }[]

  if (session.ballot_secrecy === 'secret') {
    // RLS no longer lets a non-admin read raw vote_selections rows for a
    // secret session at all (see supabase/migrations/014_ballot_secrecy.sql)
    // — a real vote_id here would be joinable against votes.user_id,
    // reconstructing exactly who chose what. This RPC returns the same
    // shape with vote_id swapped for a pseudonymous per-call ballot_ref, so
    // tallyRankedChoice/tallySimpleChoice below run completely unchanged —
    // they only ever needed *some* stable per-ballot grouping key, not the
    // real vote_id.
    const { data: tallyRows, error: tallyError } = await supabase.rpc('get_session_selections_for_tally', {
      target_session_id: sessionId,
    })

    if (tallyError) {
      return { success: false, error: tallyError.message }
    }

    selectionRows = (
      (tallyRows ?? []) as { ballot_ref: number; option_id: string; rank: number | null }[]
    ).map((row) => ({
      option_id: row.option_id,
      rank: row.rank,
      vote_id: String(row.ballot_ref),
    }))
  } else {
    const { data: selections, error: selectionsError } = await supabase
      .from('vote_selections')
      .select('option_id, rank, vote_id')
      .eq('session_id', sessionId)

    if (selectionsError) {
      return { success: false, error: selectionsError.message }
    }

    selectionRows = selections ?? []
  }

  const optionRows = options ?? []
  const totalVotes = new Set(selectionRows.map((selection) => selection.vote_id)).size

  if (session.vote_format === 'ranked') {
    const { finalCounts, rounds } = tallyRankedChoice(optionRows, selectionRows)
    return { success: true, results: finalCounts, totalVotes, resultsLocked: false, rounds }
  }

  const results = tallySimpleChoice(optionRows, selectionRows)
  return { success: true, results, totalVotes, resultsLocked: false }
}

// Per-voter roster: who voted and when, always (participation stays visible
// under ballot secrecy — see supabase/migrations/014_ballot_secrecy.sql and
// the unchanged "votes" RLS policy in 005_voting_sessions.sql). Selections
// (what each person chose) are only fetched — and only ever joined to a
// voter — for open-ballot sessions; for secret sessions this doesn't even
// attempt it, regardless of caller role, matching what a non-admin's RLS
// view would show anyway.
export async function listSessionVoters(sessionId: string): Promise<{
  success: boolean
  error?: string
  voters?: SessionVoter[]
}> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('voting_sessions')
    .select('ballot_secrecy')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return { success: false, error: sessionError?.message ?? 'Session not found' }
  }

  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('id, user_id, created_at')
    .eq('session_id', sessionId)

  if (votesError) {
    return { success: false, error: votesError.message }
  }

  const voteRows = votes ?? []
  const profiles = await fetchUserSummaries(
    supabase,
    voteRows.map((vote) => vote.user_id)
  )

  const selectionsByVoteId = new Map<string, { optionId: string; rank?: number }[]>()

  if (session.ballot_secrecy === 'open') {
    const { data: selections, error: selectionsError } = await supabase
      .from('vote_selections')
      .select('vote_id, option_id, rank')
      .eq('session_id', sessionId)

    if (selectionsError) {
      return { success: false, error: selectionsError.message }
    }

    for (const selection of selections ?? []) {
      const list = selectionsByVoteId.get(selection.vote_id) ?? []
      list.push({ optionId: selection.option_id, rank: selection.rank ?? undefined })
      selectionsByVoteId.set(selection.vote_id, list)
    }
  }

  return {
    success: true,
    voters: voteRows.map((vote) => ({
      user: profiles.get(vote.user_id) ?? null,
      votedAt: vote.created_at,
      selections: session.ballot_secrecy === 'open' ? (selectionsByVoteId.get(vote.id) ?? []) : undefined,
    })),
  }
}

