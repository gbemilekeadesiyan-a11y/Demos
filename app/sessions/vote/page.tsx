'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { signInAnonymously } from '@/app/(auth)/_lib/actions'
import { createClient } from '@/lib/supabase/client'
import { redeemSessionInviteCode } from '../_lib/actions'

function VoteEntryForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [checking, setChecking] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<{ id: string; title: string } | null>(null)
  // Arriving via a direct link isn't a workspaces→F&F surface switch (that
  // only applies to app/join/page.tsx), so an already-authenticated visitor
  // here — any account, no password step needed — just goes straight in.
  const [alreadySignedIn, setAlreadySignedIn] = useState(false)

  async function checkCode(candidate: string) {
    if (!candidate.trim()) return

    setChecking(true)
    setError(null)
    setSession(null)

    const [result, {
      data: { user },
    }] = await Promise.all([redeemSessionInviteCode(candidate.trim()), createClient().auth.getUser()])

    setChecking(false)

    if (!result.success || !result.sessionId) {
      setError(result.error ?? 'Invalid or expired code')
      return
    }

    setAlreadySignedIn(user !== null)
    setSession({ id: result.sessionId, title: result.sessionTitle ?? 'this session' })
  }

  useEffect(() => {
    const prefill = searchParams.get('code')
    if (prefill) {
      checkCode(prefill)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleVoteWithoutAccount() {
    if (!session) return

    setJoining(true)
    setError(null)

    const result = await signInAnonymously()

    setJoining(false)

    if (!result.success) {
      setError(result.error ?? 'Could not start an anonymous session')
      return
    }

    router.push(`/sessions/${session.id}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <AuraBackground />

      <div className="relative flex w-full max-w-sm flex-col items-center text-center">
        <h1 className="font-heading text-3xl text-foreground">Vote Without an Account</h1>
        <p className="mt-2 text-sm text-muted">Enter your invite code to find your session.</p>

        {!session && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              checkCode(code)
            }}
            className="mt-8 flex w-full flex-col gap-3"
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={checking}
              placeholder="Invite code"
              className="w-full rounded-lg border border-border-strong bg-surface/80 px-4 py-3 text-center text-sm text-foreground outline-none backdrop-blur-sm focus:border-foreground/40 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={checking || !code.trim()}
              className="rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {session && (
          <div className="mt-8 flex w-full flex-col items-center gap-3">
            <p className="text-sm text-foreground">
              You&apos;re invited to vote on <span className="font-medium">&quot;{session.title}&quot;</span>.
            </p>
            {alreadySignedIn ? (
              <button
                onClick={() => router.push(`/sessions/${session.id}`)}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90"
              >
                Continue to Session
              </button>
            ) : (
              <button
                onClick={handleVoteWithoutAccount}
                disabled={joining}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {joining ? 'Starting…' : 'Vote Without an Account'}
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {!alreadySignedIn && (
          <a href="/login" className="mt-6 text-xs text-muted transition hover:text-foreground">
            Have an account? Sign in instead
          </a>
        )}
      </div>
    </main>
  )
}

export default function SessionVotePage() {
  return (
    <Suspense fallback={null}>
      <VoteEntryForm />
    </Suspense>
  )
}
