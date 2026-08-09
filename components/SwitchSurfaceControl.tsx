'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { verifyPasswordForSwitch } from '@/app/(auth)/_lib/actions'

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
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setOpen(false)
    setPassword('')
    setError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await verifyPasswordForSwitch(password)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Incorrect password')
      return
    }

    router.push(SURFACE_COPY[target].href)
  }

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h2 className="font-heading text-xl text-foreground">Switch to {SURFACE_COPY[target].label}</h2>
            <p className="mt-1 text-sm text-muted">Confirm your password to continue.</p>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong"
              />

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="mt-1 flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Switch'}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-border-strong px-4 py-2.5 text-sm text-muted transition hover:border-foreground/40"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
