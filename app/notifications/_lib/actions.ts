'use server'

import { createClient } from '../../../lib/supabase/server'
import type { Notification } from './schema'

export async function listNotifications(): Promise<{
  success: boolean
  error?: string
  notifications?: Notification[]
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, payload, read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, notifications: (data ?? []) as Notification[] }
}

export async function markNotificationRead(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // RLS ("Users can mark their own notifications read") scopes this to the
  // caller's own rows; .select().single() surfaces a clear error rather
  // than a silent no-op if `id` doesn't exist or isn't theirs.
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
