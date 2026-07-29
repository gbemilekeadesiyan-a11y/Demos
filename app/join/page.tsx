'use client'

import { Suspense, useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { joinWorkspaceByCode } from '../workspaces/_lib/actions'

const CODE_LENGTH = 6

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

  async function handleSubmit(fullCode: string) {
    setLoading(true)
    setError(null)

    const result = await joinWorkspaceByCode(fullCode)

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Invalid or expired code')
      return
    }

    router.push(`/workspaces/${result.workspaceId}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4">
      <AuraBackground />

      <div className="relative flex flex-col items-center text-center">
        <div className="mb-6 flex gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((dot) => (
            <span key={dot} className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
          ))}
        </div>

        <h1 className="font-heading text-3xl text-white">The Future Awaits</h1>
        <p className="mt-2 text-sm text-neutral-400">Enter your invite code.</p>

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
              className="h-14 w-12 rounded-lg border border-neutral-700 bg-neutral-900/80 text-center text-lg text-white outline-none backdrop-blur-sm focus:border-neutral-500 disabled:opacity-50"
            />
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
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
