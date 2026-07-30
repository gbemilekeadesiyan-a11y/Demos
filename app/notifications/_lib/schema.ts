// Placeholder until `lib/types/database.ts` is generated via
// `supabase gen types typescript` — see demos-system-design.md § 3.
// `type` and `payload` shapes are written by supabase/functions/notify-events
// (session_open/session_results_released/workspace_invite_created so far).
export type Notification = {
  id: string
  type: string
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}
