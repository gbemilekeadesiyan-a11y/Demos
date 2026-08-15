'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PasswordConfirmModal } from './PasswordConfirmModal'

const SURFACE_COPY = {
  ff: { label: 'dēmos Friends & Family', href: '/family' },
  workspaces: { label: 'dēmos Workspaces', href: '/workspaces' },
} as const

// Only rendered by the dashboard for a surface once its page has confirmed
// (via getSurfaceAccess) the account has both — a single-surface account
// never sees this at all, there's nowhere for it to send them.
export function SwitchSurfaceControl({ current }: { current: 'ff' | 'workspaces' }) {
  const router = useRouter()
  const target = current === 'ff' ? 'workspaces' : 'ff'

  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
      >
        Switch to {SURFACE_COPY[target].label}
      </button>

      {open && (
        <PasswordConfirmModal
          title={`Switch to ${SURFACE_COPY[target].label}`}
          description="Confirm your password to continue."
          confirmLabel="Switch"
          onConfirm={() => router.push(SURFACE_COPY[target].href)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}
