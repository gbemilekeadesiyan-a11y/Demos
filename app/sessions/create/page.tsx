'use client'

import { Suspense, useEffect, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { addSessionOption, createVotingSession, grantSessionAccess } from '../_lib/actions'
import { listDepartments } from '@/app/workspaces/_lib/actions'
import type { DepartmentWithMembers } from '@/app/workspaces/_lib/schema'

type VoteFormat = 'single' | 'multiple' | 'ranked'
type Visibility = 'public' | 'private'
type WhoCanVote = 'all_members' | 'invited_list' | 'public_link' | 'departments'
type ResultsVisibility = 'hidden_until_close' | 'live' | 'after_you_vote'
type BallotSecrecy = 'secret' | 'open'

const BALLOT_SECRECY_COPY: Record<BallotSecrecy, { title: string; description: string }> = {
  secret: {
    title: 'Secret ballot',
    description: 'People can see that you voted, but not what you chose.',
  },
  open: {
    title: 'Open ballot',
    description: 'Everyone can see who chose what.',
  },
}

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
        <span className="h-6 w-11 rounded-full bg-border-strong transition peer-checked:bg-accent" />
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
  // Passed through from the workspace dashboard's "Create a Session" link
  // (WorkspaceDashboardClient) purely to decide which options to show here
  // — the actual enforcement is the enforce_ff_workspace_session_visibility
  // trigger in supabase/migrations/011_ff_workspaces.sql, so a stale/missing
  // param just means the form shows options the backend would reject rather
  // than a security gap.
  const isFf = searchParams.get('workspaceType') === 'ff'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [voteFormat, setVoteFormat] = useState<VoteFormat>('single')
  const [options, setOptions] = useState<OptionDraft[]>([emptyOption(), emptyOption()])

  const [visibility, setVisibility] = useState<Visibility>('public')
  const [whoCanVote, setWhoCanVote] = useState<WhoCanVote>('all_members')
  const [departments, setDepartments] = useState<DepartmentWithMembers[]>([])
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([])
  const [allowAnonymousVote, setAllowAnonymousVote] = useState(false)
  const [resultsVisibility, setResultsVisibility] = useState<ResultsVisibility>('hidden_until_close')
  // Default by workspace type, per supabase/migrations/014_ballot_secrecy.sql
  // — secret for standard workspaces, open for ff. Admins can still
  // override either way below.
  const [ballotSecrecy, setBallotSecrecy] = useState<BallotSecrecy>(isFf ? 'open' : 'secret')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Departments are Workspaces-only (018_departments.sql) — fetched purely
  // to populate the multi-select below, not shown at all for ff.
  useEffect(() => {
    if (!workspaceId || isFf) return

    let cancelled = false

    async function loadDepartments() {
      const result = await listDepartments(workspaceId!)
      if (!cancelled && result.success) {
        setDepartments(result.departments ?? [])
      }
    }

    loadDepartments()

    return () => {
      cancelled = true
    }
  }, [workspaceId, isFf])

  function toggleDepartment(id: string) {
    setSelectedDepartmentIds((current) =>
      current.includes(id) ? current.filter((deptId) => deptId !== id) : [...current, id]
    )
  }

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

    if (whoCanVote === 'departments' && selectedDepartmentIds.length === 0) {
      setError('Select at least one department.')
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
      ballotSecrecy,
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

    if (whoCanVote === 'departments') {
      for (const departmentId of selectedDepartmentIds) {
        const grantResult = await grantSessionAccess(sessionResult.sessionId, { departmentId })
        if (!grantResult.success) {
          setLoading(false)
          setError(grantResult.error ?? 'Could not grant access to one of the departments')
          return
        }
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
                      ? 'border-accent bg-accent text-accent-foreground'
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
            <p className="mb-2 text-sm font-medium text-muted">Ballot secrecy</p>
            <div className="flex flex-col gap-2">
              {(['secret', 'open'] as BallotSecrecy[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setBallotSecrecy(option)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    ballotSecrecy === option
                      ? 'border-foreground bg-foreground/5'
                      : 'border-border bg-surface/80 hover:border-border-strong'
                  }`}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {BALLOT_SECRECY_COPY[option].title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {BALLOT_SECRECY_COPY[option].description}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-amber-500">
              Choose carefully — this can&apos;t be changed once people start voting.
            </p>
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
                  {!isFf && <option value="private">Private</option>}
                </select>
                <select
                  value={whoCanVote}
                  onChange={(e) => setWhoCanVote(e.target.value as WhoCanVote)}
                  className={`${selectClass} flex-1`}
                >
                  <option value="all_members">All members</option>
                  {!isFf && <option value="invited_list">Invited list</option>}
                  <option value="public_link">Public link</option>
                  {!isFf && <option value="departments">Specific departments</option>}
                </select>
              </div>

              {whoCanVote === 'departments' && (
                <div className="rounded-lg border border-border bg-surface/60 p-3">
                  <p className="mb-2 text-xs text-muted">Departments who can vote</p>
                  {departments.length === 0 ? (
                    <p className="text-xs text-subtle">
                      No departments yet — add some from the workspace&apos;s Departments section first.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {departments.map((department) => (
                        <label key={department.id} className="flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={selectedDepartmentIds.includes(department.id)}
                            onChange={() => toggleDepartment(department.id)}
                            className="h-3.5 w-3.5 rounded border-border-strong bg-surface"
                          />
                          {department.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
            className="rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
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
