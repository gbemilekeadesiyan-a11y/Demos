'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { createWorkspace } from '../_lib/actions'

type WorkspaceTypeOption = 'standard' | 'ff'

const WORKSPACE_TYPE_COPY: Record<WorkspaceTypeOption, { title: string; description: string }> = {
  standard: {
    title: 'Team',
    description: 'Private sessions, member roles, and admin controls.',
  },
  ff: {
    title: 'Friends & Family',
    description: 'Casual and always public — keeps a running record of your group’s votes.',
  },
}

export default function CreateWorkspacePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState<WorkspaceTypeOption>('standard')
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

    router.push(`/workspaces/${result.workspaceId}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <AuraBackground />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 rounded-2xl border border-foreground/10 bg-foreground/5 p-3 backdrop-blur-sm">
            <Logo className="h-6 w-auto text-foreground" />
          </div>
          <h1 className="font-heading text-3xl text-foreground">Create your workspace</h1>
          <p className="mt-3 text-sm text-muted">
            Set up a space to create and vote on sessions — with your team or your friends.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Workspace name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm text-foreground placeholder-muted outline-none backdrop-blur-sm focus:border-border-strong"
          />

          <div className="mt-2">
            <p className="mb-2 text-left text-sm font-medium text-muted">Workspace type</p>
            <div className="flex flex-col gap-2">
              {(['standard', 'ff'] as WorkspaceTypeOption[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setType(option)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    type === option
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface/80 hover:border-border-strong'
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {WORKSPACE_TYPE_COPY[option].title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {WORKSPACE_TYPE_COPY[option].description}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-left text-xs text-amber-500">
              Choose carefully — this can&apos;t be changed once the workspace is created.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating workspace…' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </main>
  )
}
