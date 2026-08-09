import type { UserSummary } from '@/app/(auth)/_lib/schema'

// Placeholder until `lib/types/database.ts` is generated via
// `supabase gen types typescript` — see demos-system-design.md § 3.
export type VotingSession = {
  id: string
  workspace_id: string
  title: string
  description: string | null
  vote_format: 'single' | 'multiple' | 'ranked'
  visibility: 'public' | 'private'
  status: 'draft' | 'open' | 'closed' | 'results_released'
  // 'departments' is Workspaces-only (see supabase/migrations/018_departments.sql
  // — enforced there, not just by the UI) — F&F workspaces can't create the
  // sessions or workspace_groups. Resolved through the same
  // session_access_grants table as 'invited_list', just with group_id
  // (department) rows instead of/alongside user_id ones.
  who_can_vote: 'all_members' | 'invited_list' | 'public_link' | 'departments'
  allow_anonymous_vote: boolean
  results_visibility: 'hidden_until_close' | 'live' | 'after_you_vote'
  // Overrides the vote_format-driven chart default in ResultsDisplay when
  // set — see supabase/migrations/013_session_results_style.sql.
  results_style: 'pie_chart' | 'bar_chart' | 'leaderboard' | null
  // secret: non-admins see aggregate counts and who participated, never who
  // chose what. open: linkage is visible to anyone eligible to view
  // results. Defaulted by workspace type at creation (secret for standard,
  // open for ff) in createVotingSession; admins can override per session —
  // see supabase/migrations/014_ballot_secrecy.sql.
  ballot_secrecy: 'secret' | 'open'
  start_time: string | null
  end_time: string | null
  // Populated by a joined profiles lookup in listSessions/getSessionDetails;
  // null for an anonymous creator (no profiles row) rather than failing the
  // query. In practice sessions are always created by workspace admins
  // (registered users), so this should rarely be null — but the same
  // null-safe pattern as WorkspaceMembership.user is used for consistency.
  createdBy: UserSummary | null
  created_at: string
}

export type SessionOption = {
  id: string
  session_id: string
  label: string
  description: string | null
  image_url: string | null
}

// One IRV elimination round, per getSessionResults' ranked-choice tally.
// `eliminated` is empty on the final round (the one that stopped the loop,
// whether by majority, a single option remaining, or a full tie).
export type RankedRound = {
  roundNumber: number
  counts: { optionId: string; label: string; count: number }[]
  eliminated: string[]
}

// Per listSessionVoters: `selections` is only ever populated for
// ballot_secrecy = 'open' sessions — undefined (not just empty) for secret
// ones, so callers can't accidentally treat "no selections fetched" as "this
// person selected nothing."
export type SessionVoter = {
  user: UserSummary | null
  votedAt: string
  selections?: { optionId: string; rank?: number }[]
}
