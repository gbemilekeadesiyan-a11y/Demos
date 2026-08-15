'use client'

import { Suspense, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { PasswordConfirmModal } from '@/components/PasswordConfirmModal'
import { getSurfaceAccess, signInAnonymously } from '@/app/(auth)/_lib/actions'
import { redeemSessionInviteCode } from '@/app/sessions/_lib/actions'
import { joinWorkspaceByCode } from '../workspaces/_lib/actions'

const CODE_LENGTH = 8

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefill = searchParams.get('code') ?? ''

  const [digits, setDigits] = useState<string[]>(() => {
    const chars = prefill.slice(0, CODE_LENGTH).split('')
    return Array.from({ length: CODE_LENGTH }, (_, i) => chars[i] ?? '')
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // A code turns out to be a session invite code, not a workspace one: this
  // holds the session it resolved to while the two possible next prompts
  // (below) decide what happens next.
  const [pendingSession, setPendingSession] = useState<{ id: string; title: string } | null>(null)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)

  const code = digits.join('')

  useEffect(() => {
    if (code.length === CODE_LENGTH) {
      handleSubmit(code)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  function setDigit(index: number, value: string) {
    const char = value.slice(-1)
    setDigits((current) => {
      const next = [...current]
      next[index] = char
      return next
    })
    if (char && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').trim().slice(0, CODE_LENGTH)
    if (!pasted) return
    e.preventDefault()
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ''))
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
  }

  function resetToEntry() {
    setPendingSession(null)
    setShowPasswordPrompt(false)
    setDigits(Array.from({ length: CODE_LENGTH }, () => ''))
    setError(null)
    inputRefs.current[0]?.focus()
  }

  async function handleSubmit(fullCode: string) {
    setLoading(true)
    setError(null)

    // Try it as a session invite code first — falls back to the existing
    // workspace-invite flow unchanged if it isn't one. See
    // supabase/migrations/021_session_invites.sql.
    const sessionResult = await redeemSessionInviteCode(fullCode)

    if (sessionResult.success && sessionResult.sessionId) {
      const access = await getSurfaceAccess()

      setLoading(false)
      setPendingSession({ id: sessionResult.sessionId, title: sessionResult.sessionTitle ?? 'this session' })

      // Authenticated with F&F access already = a workspaces→F&F surface
      // switch, which the app already password-gates elsewhere
      // (components/SwitchSurfaceControl.tsx) — same pattern here. Anyone
      // else (logged out, or logged in without F&F access) gets the
      // vote-without-an-account path instead.
      setShowPasswordPrompt(access.success === true && access.hasFf === true)
      return
    }

    const workspaceResult = await joinWorkspaceByCode(fullCode)

    setLoading(false)

    if (!workspaceResult.success) {
      setError(workspaceResult.error ?? 'Invalid or expired code')
      return
    }

    router.push(`/workspaces/${workspaceResult.workspaceId}`)
  }

  async function handleVoteWithoutAccount() {
    if (!pendingSession) return

    setLoading(true)
    setError(null)

    const result = await signInAnonymously()

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not start an anonymous session')
      return
    }

    router.push(`/sessions/${pendingSession.id}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <AuraBackground />

      <div className="relative flex flex-col items-center text-center">
        <div className="mb-6 flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((dot) => (
            <span key={dot} className="h-1.5 w-1.5 rounded-full bg-border-strong" />
          ))}
        </div>

        <h1 className="font-heading text-3xl text-foreground">The Future Awaits</h1>
        <p className="mt-2 text-sm text-muted">Vote now, your choice is power.</p>

        {pendingSession && !showPasswordPrompt ? (
          <div className="mt-8 flex w-full max-w-xs flex-col items-center gap-3">
            <p className="text-sm text-foreground">
              You&apos;ve entered a code for a dēmos public F&amp;F session, but you don&apos;t have an account.
              Would you like to vote without one?
            </p>
            <div className="mt-1 flex w-full gap-2">
              <button
                onClick={handleVoteWithoutAccount}
                disabled={loading}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? 'Starting…' : 'Yes'}
              </button>
              <button
                onClick={() => router.push('/workspaces')}
                disabled={loading}
                className="flex-1 rounded-lg border border-border-strong px-4 py-2.5 text-sm text-muted transition hover:border-foreground/40 disabled:opacity-50"
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 flex gap-2">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el
                }}
                value={digit}
                onChange={(e) => setDigit(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={loading}
                maxLength={1}
                inputMode="text"
                className="h-14 w-12 rounded-lg border border-border-strong bg-surface/80 text-center text-lg text-foreground outline-none backdrop-blur-sm focus:border-foreground/40 disabled:opacity-50"
              />
            ))}
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>

      {pendingSession && showPasswordPrompt && (
        <PasswordConfirmModal
          title="Switch to dēmos Friends & Family"
          description="You've entered a code for a dēmos public F&F session — enter your password to switch account."
          confirmLabel="Switch & Vote"
          onConfirm={() => router.push(`/sessions/${pendingSession.id}`)}
          onCancel={resetToEntry}
        />
      )}
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={null}>
      <JoinForm />
    </Suspense>
  )
}
