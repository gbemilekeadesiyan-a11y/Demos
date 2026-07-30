import { createClient } from '@/lib/supabase/server'
import type { UserSummary } from './(auth)/_lib/schema'
import { LandingClient } from './_components/LandingClient'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Anonymous (guest) sessions don't count as "logged in" here — they're
  // scoped to voting on one session, not a real account.
  const isLoggedIn = Boolean(user && !user.is_anonymous)

  let currentUser: UserSummary | null = null

  if (isLoggedIn && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (profile) {
      currentUser = {
        id: user.id,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
      }
    }
  }

  return <LandingClient currentUser={currentUser} />
}
