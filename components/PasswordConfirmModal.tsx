'use client'

import { useState, type FormEvent } from 'react'
import { verifyPasswordForSwitch } from '@/app/(auth)/_lib/actions'

// Extracted from the modal that used to live inline in SwitchSurfaceControl
// so app/join/page.tsx's session-code-while-having-ff-access path can reuse
// the exact same password-confirm pattern instead of duplicating it.
export function PasswordConfirmModal({
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    onConfirm()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <h2 className="font-heading text-xl text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>

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
              {loading ? 'Verifying…' : confirmLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-border-strong px-4 py-2.5 text-sm text-muted transition hover:border-foreground/40"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
