'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { markAllNotificationsRead, markNotificationRead } from './actions'
import type { Notification } from './schema'

// Owns the one realtime subscription for a user's notifications, plus the
// read/read-all mutations. Pulled out of NotificationBell so a page can call
// this once and hand the resulting state/handlers to more than one bell UI
// instance (the dashboard now renders one in the mobile top bar and one in
// the desktop sidebar, both present in the DOM at once — see
// WorkspaceDashboardClient) without opening a second `notifications-${userId}`
// channel. Two components each independently calling `.channel(sameTopic)`
// raced to `.on(...)` an already-`.subscribe()`d channel and crashed with
// "cannot add postgres_changes callbacks after subscribe()"; a single
// subscriber for the page fixes that at the root instead of coordinating
// around it.
export function useNotifications(userId: string | null, initialNotifications: Notification[]) {
  const [notifications, setNotifications] = useState(initialNotifications)

  // Requires public.notifications to be in the supabase_realtime
  // publication — see supabase/migrations/012_notifications_realtime.sql.
  // RLS ("Users can view their own notifications") still scopes delivery
  // per-subscriber, but the filter here keeps the channel scoped too.
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Register every .on('postgres_changes', ...) handler before the single
    // .subscribe() call — realtime-js throws if you try to attach a
    // callback to a channel that has already joined.
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (change) => {
          setNotifications((current) => [change.new as Notification, ...current])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (change) => {
          const updated = change.new as Notification
          setNotifications((current) => current.map((n) => (n.id === updated.id ? updated : n)))
        }
      )
      .subscribe()

    // Unsubscribes and drops the channel on unmount (or when userId
    // changes) so a remount — a real navigation away and back, an account
    // switch — always opens a fresh channel rather than layering a second
    // subscription onto one the server still thinks is joined.
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  async function markRead(id: string) {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await markNotificationRead(id)
  }

  async function markAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })))
    await markAllNotificationsRead()
  }

  return { notifications, markRead, markAllRead }
}
