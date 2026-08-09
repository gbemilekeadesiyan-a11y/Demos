'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { getSurfaceAccess, login, signOut } from '../_lib/actions'

type Surface = 'ff' | 'workspaces'

const SURFACE_COPY: Record<Surface, { title: string; description: string; href: string }> = {
  ff: {
    title: 'dēmos Friends & Family',
    description: 'Casual, always-public polls with your friends and family.',
    href: '/family',
  },
  workspaces: {
    title: 'dēmos Workspaces',
    description: 'Private sessions, member roles, and admin controls for your team.',
    href: '/workspaces',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Only populated once login + getSurfaceAccess both succeed and the
  // account has both surfaces — there's no ambiguity to resolve (and so no
  // chooser to show) for a single-surface account, which is routed
  // straight through in handleSubmit instead.
  const [choosing, setChoosing] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
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

    if (!access.success) {
      await signOut()
      setError('Something went wrong. Please try again.')
      return
    }

    if (access.hasFf && access.hasWorkspaces) {
      setChoosing(true)
      return
    }

    if (access.hasFf) {
      router.push(SURFACE_COPY.ff.href)
      return
    }

    if (access.hasWorkspaces) {
      router.push(SURFACE_COPY.workspaces.href)
      return
    }

    // Neither surface enabled — signup requires at least one, so this is
    // defensive rather than an expected path.
    await signOut()
    setError('This account has no surfaces enabled. Please contact support.')
  }

  if (choosing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-2xl">
          <div className="flex flex-col items-center text-center">
            <Logo className="mb-6 h-8 w-auto text-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Where to?</h1>
            <p className="mt-2 text-sm text-muted">Your account has access to both.</p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(['ff', 'workspaces'] as Surface[]).map((option) => (
              <Link
                key={option}
                href={SURFACE_COPY[option].href}
                className="rounded-2xl border border-border bg-surface px-6 py-8 text-center transition hover:border-border-strong hover:bg-surface-hover"
              >
                <span className="block text-lg font-medium text-foreground">{SURFACE_COPY[option].title}</span>
                <span className="mt-2 block text-sm text-muted">{SURFACE_COPY[option].description}</span>
              </Link>
            ))}
          </div>
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
          <p className="mt-2 text-sm text-muted">Log in to dēmos to keep voting.</p>
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
