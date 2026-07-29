// Placeholder until `lib/types/database.ts` is generated via
// `supabase gen types typescript` — see demos-system-design.md § 3.
export type Workspace = {
  id: string
  name: string
  type: 'standard' | 'ff'
  created_by: string
  settings: Record<string, unknown>
}

export type WorkspaceMembership = {
  id: string
  workspace_id: string
  user_id: string
  role: 'admin' | 'moderator' | 'member'
  status: 'active' | 'pending'
  created_at: string
}
