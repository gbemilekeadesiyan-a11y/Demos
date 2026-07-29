// Placeholder until `lib/types/database.ts` is generated via
// `supabase gen types typescript` — see demos-system-design.md § 3.
export type Workspace = {
  id: string
  name: string
  type: 'standard' | 'ff'
  created_by: string
  settings: Record<string, unknown>
}
