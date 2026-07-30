'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { Logo } from '@/components/Logo'
import { createWorkspace } from '../_lib/actions'

export default function CreateWorkspacePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createWorkspace({ name, type: 'standard' })

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
            Set up a space for your team to create and vote on sessions.
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

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating workspace…' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </main>
  )
}
