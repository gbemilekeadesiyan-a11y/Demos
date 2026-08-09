import type { UserSummary } from '@/app/(auth)/_lib/schema'

// Placeholder until `lib/types/database.ts` is generated via
// `supabase gen types typescript` — see demos-system-design.md § 3.
export type Workspace = {
  id: string
  name: string
  type: 'standard' | 'ff'
  // Populated by a joined profiles lookup in listMyWorkspaces /
  // getWorkspaceDetails; null for an anonymous creator (no profiles row)
  // rather than failing the query.
  createdBy: UserSummary | null
  settings: Record<string, unknown>
}

// Populated by getWorkspaceStats — see get_workspace_stats in
// supabase/migrations/016_workspace_stats.sql. `trends` compares a rolling
// 30-day window against the preceding one and is already a signed delta
// (current period minus previous), not a raw previous-period value — render
// it directly. Each trend field is null whenever the previous period has no
// data of its own to compare against (e.g. a brand-new workspace) — a
// delta against a nonexistent baseline, not a real zero, so callers should
// hide the trend indicator entirely rather than render it as "+N". There's
// no trend for activeSessions: it's a live snapshot (current status), not
// something a prior-period figure is meaningful against. averageTurnout
// (overall and within trends) excludes public_link sessions — their
// eligible pool is unbounded, so no turnout percentage is computable for
// them — and is null when no session in scope has a countable eligible
// pool at all.
export type WorkspaceStats = {
  totalSessions: number
  totalVotes: number
  averageTurnout: number | null
  activeSessions: number
  trends?: {
    totalSessions: number | null
    totalVotes: number | null
    averageTurnout: number | null
  }
}

// Populated by getWorkspaceSessionSummaries — see
// get_workspace_session_summaries in supabase/migrations/016_workspace_stats.sql.
// lastActivity is the most recent vote's timestamp, falling back to the
// session's created_at when it has none yet. turnoutPct is null under the
// same public_link/no-eligible-pool rule as WorkspaceStats.averageTurnout.
export type WorkspaceSessionSummary = {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'open' | 'closed' | 'results_released'
  createdAt: string
  lastActivity: string
  voteCount: number
  turnoutPct: number | null
}

export type WorkspaceMembership = {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'pending'
  // 'self' — the user requested to join (approveMembership/rejectMembership
  // is the admin-side response). 'admin' — an admin invited this person
  // directly via inviteByIdentifier (respondToInvite is the user-side
  // response). See supabase/migrations/017_workspace_ownership_and_invites.sql.
  initiated_by: 'self' | 'admin'
  created_at: string
  // Populated by a joined profiles lookup in getWorkspaceDetails; null for
  // anonymous members (no profiles row) rather than failing the query.
  user: UserSummary | null
}

// Departments — the WorkspaceGroup entity deferred in
// demos-system-design.md § 3. Workspaces-only, not F&F (enforced in
// supabase/migrations/018_departments.sql, not just by the UI never
// offering it for an ff workspace).
export type WorkspaceGroup = {
  id: string
  workspace_id: string
  name: string
  created_at: string
}

// Returned by listDepartments — memberIds is workspace_group_members'
// membership_id column (a workspace_memberships.id, not a bare user id;
// see 018_departments.sql), fetched via one embedded query per workspace
// rather than a per-department round trip.
export type DepartmentWithMembers = WorkspaceGroup & { memberIds: string[] }
