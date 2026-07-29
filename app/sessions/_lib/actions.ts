'use server'

import { createClient } from '../../../lib/supabase/server'
import type { UserSummary } from '../../(auth)/_lib/schema'
import type { SessionOption, VotingSession } from './schema'

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
    start_time: row.start_time,
    end_time: row.end_time,
    createdBy: profiles.get(row.created_by) ?? null,
    created_at: row.created_at,
  }
}

export async function createVotingSession(
  workspaceId: string,
  formData: {
    title: string
    description?: string
    voteFormat: 'single' | 'multiple' | 'ranked'
    visibility: 'public' | 'private'
    whoCanVote: 'all_members' | 'invited_list' | 'public_link'
    allowAnonymousVote: boolean
    resultsVisibility: 'hidden_until_close' | 'live' | 'after_you_vote'
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

export async function grantSessionAccess(
  sessionId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('session_access_grants')
    .insert({ session_id: sessionId, user_id: userId })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function openSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('voting_sessions')
    .update({ status: 'open' })
    .eq('id', sessionId)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function closeSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('voting_sessions')
    .update({ status: 'closed' })
    .eq('id', sessionId)
    .eq('status', 'open')
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function releaseResults(sessionId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('voting_sessions')
    .update({ status: 'results_released' })
    .eq('id', sessionId)
    .eq('status', 'closed')
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
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
}> {
  const supabase = await createClient()

  const { data: session, error: sessionError } = await supabase
    .from('voting_sessions')
    .select('vote_format')
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
    return { success: true, results: [], totalVotes: 0, resultsLocked: true }
  }

  const { data: options, error: optionsError } = await supabase
    .from('session_options')
    .select('id, label')
    .eq('session_id', sessionId)

  if (optionsError) {
    return { success: false, error: optionsError.message }
  }

  const { data: selections, error: selectionsError } = await supabase
    .from('vote_selections')
    .select('option_id, rank, vote_id')
    .eq('session_id', sessionId)

  if (selectionsError) {
    return { success: false, error: selectionsError.message }
  }

  const optionRows = options ?? []
  const selectionRows = selections ?? []
  const totalVotes = new Set(selectionRows.map((selection) => selection.vote_id)).size

  const results =
    session.vote_format === 'ranked'
      ? tallyRankedChoice(optionRows, selectionRows)
      : tallySimpleChoice(optionRows, selectionRows)

  return { success: true, results, totalVotes, resultsLocked: false }
}

function tallySimpleChoice(
  options: { id: string; label: string }[],
  selections: { option_id: string }[]
): { optionId: string; label: string; count: number }[] {
  const counts = new Map(options.map((option) => [option.id, 0]))

  for (const selection of selections) {
    counts.set(selection.option_id, (counts.get(selection.option_id) ?? 0) + 1)
  }

  return options.map((option) => ({
    optionId: option.id,
    label: option.label,
    count: counts.get(option.id) ?? 0,
  }))
}

// Instant Runoff Voting, per demos-system-design.md § 8.3: tally first
// choices, eliminate the lowest, redistribute those ballots to their
// next-ranked remaining option, repeat until majority. Two behaviors the
// design doc doesn't spell out, decided here:
// - A ballot with no remaining ranked option left ("exhausted") is dropped
//   from that round's count and from the majority denominator, rather than
//   counted for no one — standard IRV practice.
// - A tie for lowest eliminates all tied options in the same round, rather
//   than picking one arbitrarily.
// Returned counts are each option's tally in the last round it was still
// standing (0 once eliminated), since the return shape is a flat list, not
// a round-by-round history.
function tallyRankedChoice(
  options: { id: string; label: string }[],
  selections: { option_id: string; rank: number | null; vote_id: string }[]
): { optionId: string; label: string; count: number }[] {
  const ballots = new Map<string, { optionId: string; rank: number }[]>()

  for (const selection of selections) {
    if (selection.rank === null) continue
    const ballot = ballots.get(selection.vote_id) ?? []
    ballot.push({ optionId: selection.option_id, rank: selection.rank })
    ballots.set(selection.vote_id, ballot)
  }

  for (const ballot of ballots.values()) {
    ballot.sort((a, b) => a.rank - b.rank)
  }

  const remaining = new Set(options.map((option) => option.id))
  const finalCounts = new Map(options.map((option) => [option.id, 0]))

  while (remaining.size > 0) {
    const roundCounts = new Map<string, number>()
    for (const id of remaining) roundCounts.set(id, 0)

    let countedBallots = 0

    for (const ballot of ballots.values()) {
      const firstRemaining = ballot.find((choice) => remaining.has(choice.optionId))
      if (!firstRemaining) continue
      roundCounts.set(firstRemaining.optionId, (roundCounts.get(firstRemaining.optionId) ?? 0) + 1)
      countedBallots += 1
    }

    for (const [id, count] of roundCounts) {
      finalCounts.set(id, count)
    }

    const majorityThreshold = countedBallots / 2
    const hasMajority = [...roundCounts.values()].some((count) => count > majorityThreshold)

    if (hasMajority || remaining.size === 1) {
      break
    }

    const lowestCount = Math.min(...roundCounts.values())
    const toEliminate = [...roundCounts.entries()]
      .filter(([, count]) => count === lowestCount)
      .map(([id]) => id)

    for (const id of toEliminate) {
      remaining.delete(id)
    }

    if (remaining.size === 0) {
      // Every remaining option tied for lowest — stop rather than wipe
      // the board; finalCounts already holds this round's tallies.
      for (const id of toEliminate) {
        remaining.add(id)
      }
      break
    }
  }

  return options.map((option) => ({
    optionId: option.id,
    label: option.label,
    count: finalCounts.get(option.id) ?? 0,
  }))
}
