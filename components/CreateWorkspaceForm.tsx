'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { createWorkspace } from '@/app/workspaces/_lib/actions'

// `type` is fixed by which surface's create route rendered this (see
// app/workspaces/create/page.tsx vs app/family/create/page.tsx) — not a
// picker the user chooses from. Pre-surfaces, this form let anyone pick
// 'ff' from a workspace-type radio regardless of which surface they were
// on; post-surfaces that's a dead end (a Workspaces-surface account
// creating an 'ff' group would never see it again — listMyWorkspaces
// filters by surface, see supabase/migrations/015_surface_access.sql), so
// the choice now comes from the route, not a form field.
const COPY: Record<
  'standard' | 'ff',
  {
    logoWrapClass: string
    heading: string
    description: string
    namePlaceholder: string
    submitLabel: string
    submittingLabel: string
    buttonClass: string
    redirectBase: string
  }
> = {
  standard: {
    logoWrapClass: 'border-foreground/10 bg-foreground/5',
    heading: 'Create your workspace',
    description: 'Set up a space to create and vote on sessions — with your team.',
    namePlaceholder: 'Workspace name',
    submitLabel: 'Create Workspace',
    submittingLabel: 'Creating workspace…',
    buttonClass: 'bg-accent text-accent-foreground',
    redirectBase: '/workspaces',
  },
  ff: {
    logoWrapClass: 'border-fuchsia-400/20 bg-fuchsia-500/5',
    heading: 'Start a group',
    description: 'Casual and always public — keeps a running record of your group’s votes.',
    namePlaceholder: 'Group name',
    submitLabel: 'Create Group',
    submittingLabel: 'Creating group…',
    buttonClass: 'bg-fuchsia-500 text-white',
    redirectBase: '/family',
  },
}

export function CreateWorkspaceForm({ type }: { type: 'standard' | 'ff' }) {
  const router = useRouter()
  const copy = COPY[type]
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createWorkspace({ name, type })

    if (!result.success) {
      setLoading(false)
      setError(result.error ?? 'Something went wrong. Please try again.')
      return
    }

    router.push(`${copy.redirectBase}/${result.workspaceId}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <AuraBackground />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-6 rounded-2xl border p-3 backdrop-blur-sm ${copy.logoWrapClass}`}>
            <Logo className="h-6 w-auto text-foreground" />
          </div>
          <h1 className="font-heading text-3xl text-foreground">{copy.heading}</h1>
          <p className="mt-3 text-sm text-muted">{copy.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <input
            type="text"
            placeholder={copy.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm text-foreground placeholder-muted outline-none backdrop-blur-sm focus:border-border-strong"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 rounded-full px-4 py-3 text-sm font-medium transition hover:opacity-90 disabled:opacity-50 ${copy.buttonClass}`}
          >
            {loading ? copy.submittingLabel : copy.submitLabel}
          </button>
        </form>
      </div>
    </main>
  )
}
