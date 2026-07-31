'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { markAllNotificationsRead, markNotificationRead } from '../_lib/actions'
import type { Notification } from '../_lib/schema'

type Tab = 'all' | 'unread'
type NotificationKind = 'vote' | 'results' | 'invite' | 'default'

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 12 6 8Z" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </svg>
  )
}

function VoteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

function ResultsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  )
}

function InviteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M18 8v5M15.5 10.5h5" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

function describeNotification(n: Notification): {
  kind: NotificationKind
  title: string
  description: string
  href: string
  actionLabel: string
} {
  const payload = n.payload as Record<string, unknown>

  switch (n.type) {
    case 'session_open':
      return {
        kind: 'vote',
        title: 'Voting is open',
        description: `"${payload.sessionTitle ?? 'A session'}" is now open for voting.`,
        href: `/sessions/${payload.sessionId}`,
        actionLabel: 'Vote',
      }
    case 'session_results_released':
      return {
        kind: 'results',
        title: 'Results are in',
        description: `Results for "${payload.sessionTitle ?? 'a session'}" have been released.`,
        href: `/sessions/${payload.sessionId}`,
        actionLabel: 'View results',
      }
    case 'workspace_invite_created':
      return {
        kind: 'invite',
        title: 'New invite created',
        description: 'A new invite link was generated for your workspace.',
        href: `/workspaces/${payload.workspaceId}`,
        actionLabel: 'View',
      }
    default:
      return {
        kind: 'default',
        title: 'Notification',
        description: 'You have a new notification.',
        href: '#',
        actionLabel: 'View',
      }
  }
}

function formatDateHeading(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    return 'Today'
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  const day = date.getDate()
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th'

  return `${day}${suffix} ${date.toLocaleDateString('en-US', { month: 'short' })}, ${date.getFullYear()}`
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  if (date.toDateString() === now.toDateString()) {
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000)
    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
    const diffHours = Math.floor(diffMinutes / 60)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  }

  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function NotificationBell({
  userId,
  initialNotifications,
}: {
  userId: string | null
  initialNotifications: Notification[]
}) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  // Requires public.notifications to be in the supabase_realtime
  // publication — see supabase/migrations/012_notifications_realtime.sql.
  // RLS ("Users can view their own notifications") still scopes delivery
  // per-subscriber, but the filter here keeps the channel scoped too.
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // The panel is portaled to document.body (see the render below), so it's
  // no longer a DOM descendant of triggerRef — a click inside it must be
  // checked against panelRef separately, or every click on the panel itself
  // would be treated as "outside" and immediately close it.
  useEffect(() => {
    if (!open) return

    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // Portaling escapes any stacking context an ancestor (e.g. a
  // transform/filter/backdrop-filter on the sidebar) would otherwise trap
  // the panel behind, which means it can no longer rely on `absolute` +
  // the trigger's `relative` parent for placement — position it in
  // viewport coordinates instead, recalculated on open and on
  // resize/scroll so it stays anchored to the bell.
  useLayoutEffect(() => {
    if (!open) return

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelWidth = 384 // matches the panel's w-96
      const margin = 16
      const left = Math.min(rect.left, window.innerWidth - panelWidth - margin)
      setPosition({ top: rect.bottom + 8, left: Math.max(margin, left) })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  async function handleMarkRead(id: string) {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await markNotificationRead(id)
  }

  async function handleMarkAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })))
    await markAllNotificationsRead()
  }

  if (!userId) return null

  const visible = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  const groups: { heading: string; items: Notification[] }[] = []
  for (const n of visible) {
    const heading = formatDateHeading(n.created_at)
    const group = groups.find((g) => g.heading === heading)
    if (group) {
      group.items.push(n)
    } else {
      groups.push({ heading, items: [n] })
    }
  }

  return (
    <div className="relative" ref={triggerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: position.top, left: position.left }}
            className="fixed z-[9999] w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface/[0.98] shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-divider px-4 py-3">
              <h2 className="font-heading text-lg text-foreground">Notifications</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="rounded-lg p-1 text-muted transition hover:bg-foreground/5 hover:text-foreground"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1 px-4 pt-3">
              {(['all', 'unread'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    tab === t
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted hover:bg-foreground/5 hover:text-foreground'
                  }`}
                >
                  {t === 'all' ? 'All' : `Unread (${unreadCount})`}
                </button>
              ))}
            </div>

            <div className="max-h-96 overflow-y-auto px-2 py-3">
              {groups.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted">
                  {tab === 'unread' ? "You're all caught up." : 'No notifications yet.'}
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.heading} className="mb-3 last:mb-0">
                    <p className="px-2 pb-1.5 text-xs uppercase tracking-wide text-subtle">{group.heading}</p>
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((n) => {
                        const view = describeNotification(n)
                        return (
                          <div
                            key={n.id}
                            className={`rounded-xl px-2 py-2.5 transition ${!n.read ? 'bg-foreground/5' : ''}`}
                          >
                            <div className="flex gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted">
                                {view.kind === 'vote' && <VoteIcon className="h-4 w-4" />}
                                {view.kind === 'results' && <ResultsIcon className="h-4 w-4" />}
                                {view.kind === 'invite' && <InviteIcon className="h-4 w-4" />}
                                {view.kind === 'default' && <BellIcon className="h-4 w-4" />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-medium text-foreground">{view.title}</p>
                                  {!n.read && (
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-muted">{view.description}</p>
                                <p className="mt-1 text-[11px] text-subtle">{formatTimestamp(n.created_at)}</p>
                                <div className="mt-2 flex items-center gap-3 text-xs">
                                  <Link
                                    href={view.href}
                                    onClick={() => {
                                      if (!n.read) handleMarkRead(n.id)
                                      setOpen(false)
                                    }}
                                    className="rounded-full border border-border px-2.5 py-1 text-foreground transition hover:border-border-strong"
                                  >
                                    {view.actionLabel}
                                  </Link>
                                  {!n.read && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkRead(n.id)}
                                      className="text-muted transition hover:text-foreground"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-divider px-4 py-3">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="text-xs text-muted transition hover:text-foreground"
              >
                Go to Settings
              </Link>
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-foreground transition hover:border-border-strong disabled:opacity-40"
              >
                Mark all as read
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
