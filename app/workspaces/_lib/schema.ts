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

export type WorkspaceMembership = {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'pending'
  created_at: string
  // Populated by a joined profiles lookup in getWorkspaceDetails; null for
  // anonymous members (no profiles row) rather than failing the query.
  user: UserSummary | null
}
