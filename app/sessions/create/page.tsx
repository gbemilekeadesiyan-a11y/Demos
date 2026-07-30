'use client'

import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { addSessionOption, createVotingSession } from '../_lib/actions'

type VoteFormat = 'single' | 'multiple' | 'ranked'
type Visibility = 'public' | 'private'
type WhoCanVote = 'all_members' | 'invited_list' | 'public_link'
type ResultsVisibility = 'hidden_until_close' | 'live' | 'after_you_vote'

type OptionDraft = {
  label: string
  description: string
  imageUrl: string
}

function emptyOption(): OptionDraft {
  return { label: '', description: '', imageUrl: '' }
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface/60 px-4 py-3">
      <div>
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <span className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-border-strong transition peer-checked:bg-foreground" />
        <span className="absolute left-1 h-4 w-4 rounded-full bg-background transition peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

const inputClass =
  'rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm text-foreground placeholder-muted outline-none backdrop-blur-sm focus:border-border-strong'

const selectClass =
  'rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm text-foreground outline-none backdrop-blur-sm focus:border-border-strong'

function CreateSessionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const workspaceId = searchParams.get('workspaceId')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [voteFormat, setVoteFormat] = useState<VoteFormat>('single')
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(), emptyOption()])

  const [visibility, setVisibility] = useState<Visibility>('public')
  const [whoCanVote, setWhoCanVote] = useState<WhoCanVote>('all_members')
  const [allowAnonymousVote, setAllowAnonymousVote] = useState(false)
  const [resultsVisibility, setResultsVisibility] = useState<ResultsVisibility>('hidden_until_close')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions((current) => current.map((option, i) => (i === index ? { ...option, ...patch } : option)))
  }

  function addOption() {
    setOptions((current) => [...current, emptyOption()])
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!workspaceId) {
      setError('Missing workspace — open this page from a workspace to create a session.')
      return
    }

    const filledOptions = options.filter((option) => option.label.trim().length > 0)
    if (filledOptions.length < 2) {
      setError('Add at least two options.')
      return
    }

    setLoading(true)

    const sessionResult = await createVotingSession(workspaceId, {
      title,
      description: description || undefined,
      voteFormat,
      visibility,
      whoCanVote,
      allowAnonymousVote,
      resultsVisibility,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    })

    if (!sessionResult.success || !sessionResult.sessionId) {
      setLoading(false)
      setError(sessionResult.error ?? 'Could not create session')
      return
    }

    for (const option of filledOptions) {
      const optionResult = await addSessionOption(sessionResult.sessionId, {
        label: option.label,
        description: option.description || undefined,
        imageUrl: option.imageUrl || undefined,
      })

      if (!optionResult.success) {
        setLoading(false)
        setError(optionResult.error ?? 'Could not add one of the options')
        return
      }
    }

    router.push(`/sessions/${sessionResult.sessionId}`)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-12">
      <AuraBackground />

      <div className="relative mx-auto max-w-lg">
        <button
          onClick={() => router.back()}
          className="text-sm text-muted transition hover:text-foreground"
        >
          ← Back
        </button>

        <h1 className="mt-4 font-heading text-3xl text-foreground">Create a session</h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Ask a question"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted">Vote format</p>
            <div className="flex gap-2">
              {(['single', 'multiple', 'ranked'] as VoteFormat[]).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setVoteFormat(format)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${
                    voteFormat === format
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-surface/80 text-muted hover:border-border-strong'
                  }`}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted">Options</p>
            <div className="flex flex-col gap-3">
              {options.map((option, index) => (
                <div key={index} className="rounded-lg border border-border bg-surface/60 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${index + 1}`}
                      value={option.label}
                      onChange={(e) => updateOption(index, { label: e.target.value })}
                      className={`${inputClass} flex-1 py-2`}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        aria-label="Remove option"
                        className="text-muted transition hover:text-foreground"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={option.description}
                    onChange={(e) => updateOption(index, { description: e.target.value })}
                    className={`${inputClass} mt-2 w-full py-2 text-xs`}
                  />
                  <input
                    type="text"
                    placeholder="Image URL (optional) — upload coming soon"
                    value={option.imageUrl}
                    onChange={(e) => updateOption(index, { imageUrl: e.target.value })}
                    className={`${inputClass} mt-2 w-full border-dashed py-2 text-xs`}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOption}
              className="mt-3 w-full rounded-lg border border-border bg-surface/60 py-2 text-sm text-muted transition hover:border-border-strong"
            >
              + Add Another Option
            </button>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-muted">Session settings</p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className={`${selectClass} flex-1`}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <select
                  value={whoCanVote}
                  onChange={(e) => setWhoCanVote(e.target.value as WhoCanVote)}
                  className={`${selectClass} flex-1`}
                >
                  <option value="all_members">All members</option>
                  <option value="invited_list">Invited list</option>
                  <option value="public_link">Public link</option>
                </select>
              </div>

              <select
                value={resultsVisibility}
                onChange={(e) => setResultsVisibility(e.target.value as ResultsVisibility)}
                className={selectClass}
              >
                <option value="hidden_until_close">Hide results until closed</option>
                <option value="live">Show live results</option>
                <option value="after_you_vote">Show results after you vote</option>
              </select>

              <Toggle
                checked={allowAnonymousVote}
                onChange={setAllowAnonymousVote}
                label="Enable anonymous voting"
                hint="Your vote will not be disclosed to others."
              />

              <div className="flex gap-3">
                <label className="flex-1 text-xs text-muted">
                  Start time
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={`${inputClass} mt-1 w-full py-2`}
                  />
                </label>
                <label className="flex-1 text-xs text-muted">
                  End time
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={`${inputClass} mt-1 w-full py-2`}
                  />
                </label>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating session…' : 'Create Session'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function CreateSessionPage() {
  return (
    <Suspense fallback={null}>
      <CreateSessionForm />
    </Suspense>
  )
}
