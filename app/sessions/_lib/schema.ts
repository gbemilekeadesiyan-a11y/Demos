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
  who_can_vote: 'all_members' | 'invited_list' | 'public_link'
  allow_anonymous_vote: boolean
  results_visibility: 'hidden_until_close' | 'live' | 'after_you_vote'
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
