'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { getSurfaceAccess, login, signOut } from '../_lib/actions'

type Surface = 'ff' | 'workspaces'

const SURFACE_COPY: Record<Surface, { title: string; description: string; href: string; missingError: string }> = {
  ff: {
    title: 'Friends & Family',
    description: 'Casual, always-public polls with your friends and family.',
    href: '/family',
    missingError: 'No Friends & Family account exists for this email.',
  },
  workspaces: {
    title: 'Workspaces',
    description: 'Private sessions, member roles, and admin controls for your team.',
    href: '/workspaces',
    missingError: 'No Workspaces account exists for this email.',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const [surface, setSurface] = useState<Surface | null>(null)
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!surface) return

    setLoading(true)
    setError(null)

    const result = await login(form)

    if (!result.success) {
      setLoading(false)
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    const access = await getSurfaceAccess()
    setLoading(false)

    const hasSurface = surface === 'ff' ? access.hasFf : access.hasWorkspaces

    if (!access.success || !hasSurface) {
      await signOut()
      setError(access.success ? SURFACE_COPY[surface].missingError : 'Something went wrong. Please try again.')
      return
    }

    router.push(SURFACE_COPY[surface].href)
  }

  if (!surface) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <Logo className="mb-6 h-8 w-auto text-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
            <p className="mt-2 text-sm text-muted">Which account do you want to log in to?</p>
          </div>

          <div className="mt-8 flex flex-col gap-2">
            {(['ff', 'workspaces'] as Surface[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSurface(option)}
                className="rounded-lg border border-border bg-surface px-4 py-3 text-left transition hover:border-border-strong"
              >
                <span className="block text-sm font-medium text-foreground">{SURFACE_COPY[option].title}</span>
                <span className="mt-0.5 block text-xs text-muted">{SURFACE_COPY[option].description}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            Don&apos;t have an account?{' '}
            <a href="/signup" className="text-foreground underline">
              Sign up
            </a>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-6 h-8 w-auto text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted">Log in to {SURFACE_COPY[surface].title}.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Logging in…' : 'Continue'}
          </button>

          <button
            type="button"
            onClick={() => {
              setSurface(null)
              setError(null)
            }}
            className="text-sm text-muted transition hover:text-foreground"
          >
            ← Back
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-foreground underline">
            Sign up
          </a>
        </p>
      </div>
    </main>
  )
}
