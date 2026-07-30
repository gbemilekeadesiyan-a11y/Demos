import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingClient } from './_components/LandingClient'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Anonymous (guest) sessions don't count as "logged in" here — they're
  // scoped to voting on one session, not a real account, and should still
  // see the landing page like any other visitor.
  if (user && !user.is_anonymous) {
    redirect('/workspaces')
  }

  return <LandingClient />
}
