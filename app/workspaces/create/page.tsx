'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { createWorkspace } from '../_lib/actions'

const NOISE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4">
      {/* Aura: deep navy glow fading to black */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(30,58,138,0.45), transparent 70%), radial-gradient(ellipse 60% 50% at 50% 20%, rgba(59,130,246,0.15), transparent 70%)',
        }}
      />

      {/* Grain texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_URL}")` }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
            <Logo className="h-6 w-auto text-white" />
          </div>
          <h1 className="font-serif text-3xl text-white">
            <em>Create</em> your workspace
          </h1>
          <p className="mt-3 text-sm text-neutral-400">
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
            className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none backdrop-blur-sm focus:border-neutral-600"
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full bg-white px-4 py-3 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
          >
            {loading ? 'Creating workspace…' : 'Create Workspace'}
          </button>
        </form>
      </div>
    </main>
  )
}
