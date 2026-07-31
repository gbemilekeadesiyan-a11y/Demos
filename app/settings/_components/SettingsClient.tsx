'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuraBackground } from '@/components/AuraBackground'
import { changePassword, deleteAccount, updateEmail, updateProfile } from '../../(auth)/_lib/actions'

const inputClass =
  'rounded-lg border border-border bg-surface/80 px-4 py-3 text-sm text-foreground placeholder-muted outline-none backdrop-blur-sm focus:border-border-strong'

const PASSWORD_RULES: { label: string; test: (password: string) => boolean }[] = [
  { label: 'One lowercase character', test: (password) => /[a-z]/.test(password) },
  { label: 'One uppercase character', test: (password) => /[A-Z]/.test(password) },
  { label: 'One number', test: (password) => /[0-9]/.test(password) },
  { label: 'One special character', test: (password) => /[^A-Za-z0-9]/.test(password) },
  { label: '8 characters minimum', test: (password) => password.length >= 8 },
  { label: '50 characters maximum', test: (password) => password.length <= 50 },
]

export function SettingsClient({
  email,
  username,
  firstName,
  lastName,
}: {
  email: string
  username: string
  firstName: string
  lastName: string
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-12">
      <AuraBackground />

      <div className="relative mx-auto flex max-w-lg flex-col gap-10">
        <div>
          <Link href="/workspaces" className="text-sm text-muted transition hover:text-foreground">
            ← Back
          </Link>
          <h1 className="mt-4 font-heading text-3xl text-foreground">Settings</h1>
        </div>

        <ProfilePhotoSection />
        <BasicInformationSection
          initialUsername={username}
          initialFirstName={firstName}
          initialLastName={lastName}
          initialEmail={email}
        />
        <ChangePasswordSection />
        <DeleteAccountSection username={username} />
      </div>
    </main>
  )
}

function DeleteAccountSection({ username }: { username: string }) {
  const router = useRouter()
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canDelete = confirmation.length > 0 && confirmation === username

  async function handleDelete() {
    setError(null)
    if (!canDelete) return

    setLoading(true)
    const result = await deleteAccount(confirmation)
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not delete your account')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <section className="rounded-lg border border-red-900/50 bg-red-950/10 p-5">
      <h2 className="text-sm font-medium text-red-400">Danger zone</h2>
      <p className="mt-2 text-xs text-muted">
        Deleting your account removes your profile and disables sign-in for it. Workspaces and
        sessions you created stay intact for other members — only your own membership and votes are
        removed. This can&apos;t be undone.
      </p>

      <label className="mt-4 block text-xs text-muted">
        Type <span className="font-mono text-foreground">{username}</span> to confirm
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className={`${inputClass} mt-1 w-full`}
        />
      </label>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || loading}
        className="mt-3 rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Deleting…' : 'Delete my account'}
      </button>
    </section>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface/60 p-5">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ProfilePhotoSection() {
  return (
    <SectionCard title="Profile photo">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-xl text-subtle">
          ?
        </div>
        <div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-border px-4 py-2 text-xs text-subtle"
          >
            Upload photo
          </button>
          <p className="mt-2 text-xs text-muted">Photo uploads aren&apos;t available yet.</p>
        </div>
      </div>
    </SectionCard>
  )
}

function BasicInformationSection({
  initialUsername,
  initialFirstName,
  initialLastName,
  initialEmail,
}: {
  initialUsername: string
  initialFirstName: string
  initialLastName: string
  initialEmail: string
}) {
  const [username, setUsername] = useState(initialUsername)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [lastName, setLastName] = useState(initialLastName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [changingEmail, setChangingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailRequested, setEmailRequested] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setLoading(true)

    const result = await updateProfile({ username, firstName, lastName })

    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not update your profile')
      return
    }

    setSaved(true)
  }

  async function handleUpdateEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEmailError(null)
    setEmailLoading(true)

    const result = await updateEmail(newEmail)

    setEmailLoading(false)

    if (!result.success) {
      setEmailError(result.error ?? 'Could not start the email change')
      return
    }

    setEmailRequested(true)
  }

  return (
    <SectionCard title="Basic information">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-muted">
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex-1 text-xs text-muted">
            First name
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
          <label className="flex-1 text-xs text-muted">
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400">Profile updated.</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 self-start rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Update'}
        </button>
      </form>

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs text-muted">Email address</p>
        <p className="mt-1 text-sm text-foreground">{initialEmail}</p>

        {!changingEmail ? (
          <button
            type="button"
            onClick={() => setChangingEmail(true)}
            className="mt-2 text-xs text-muted underline transition hover:text-foreground"
          >
            Change your email address
          </button>
        ) : emailRequested ? (
          <p className="mt-2 text-xs text-emerald-400">
            Check {newEmail} for a confirmation link — your email won&apos;t change until you click it.
          </p>
        ) : (
          <form onSubmit={handleUpdateEmail} className="mt-3 flex flex-col gap-2">
            <input
              type="email"
              placeholder="New email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className={`${inputClass} w-full`}
            />
            {emailError && <p className="text-sm text-red-400">{emailError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={emailLoading}
                className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {emailLoading ? 'Sending…' : 'Update Email'}
              </button>
              <button
                type="button"
                onClick={() => setChangingEmail(false)}
                className="rounded-full border border-border-strong px-4 py-2 text-xs text-muted transition hover:border-foreground/40"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </SectionCard>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const rulesSatisfied = PASSWORD_RULES.every((rule) => rule.test(newPassword))
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = currentPassword.length > 0 && rulesSatisfied && passwordsMatch

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (!canSubmit) {
      return
    }

    setLoading(true)
    const result = await changePassword({ currentPassword, newPassword })
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? 'Could not change your password')
      return
    }

    setSaved(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <SectionCard title="Change password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-xs text-muted">
          Verify current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <label className="text-xs text-muted">
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(newPassword)
            return (
              <li
                key={rule.label}
                className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-400' : 'text-muted'}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${met ? 'bg-emerald-400' : 'bg-border-strong'}`} />
                {rule.label}
              </li>
            )
          })}
        </ul>

        <label className="text-xs text-muted">
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={`${inputClass} mt-1 w-full`}
          />
        </label>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="text-xs text-red-400">Passwords don&apos;t match.</p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400">Password changed.</p>}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="mt-1 self-start rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update'}
        </button>
      </form>
    </SectionCard>
  )
}
