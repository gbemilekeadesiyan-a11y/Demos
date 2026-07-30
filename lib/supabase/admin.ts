import { createClient } from '@supabase/supabase-js'

// Service-role client for privileged operations the regular anon-key
// client (server.ts) can't perform — currently just auth.admin.deleteUser
// in deleteAccount() (app/(auth)/_lib/actions.ts). SUPABASE_SERVICE_ROLE_KEY
// is server-only (no NEXT_PUBLIC_ prefix, never bundled to the client) —
// this file must only ever be imported from 'use server' code.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
