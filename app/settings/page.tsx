import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './_components/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, first_name, last_name')
    .eq('id', user.id)
    .single()

  return (
    <SettingsClient
      email={user.email ?? ''}
      username={profile?.username ?? ''}
      firstName={profile?.first_name ?? ''}
      lastName={profile?.last_name ?? ''}
    />
  )
}
