'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AuraBackground } from '@/components/AuraBackground'
import { changePassword, updateEmail, updateProfile } from '../../(auth)/_lib/actions'

const inputClass =
  'rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none backdrop-blur-sm focus:border-neutral-600'

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
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 px-4 py-12">
      <AuraBackground />

      <div className="relative mx-auto flex max-w-lg flex-col gap-10">
        <div>
          <Link href="/workspaces" className="text-sm text-neutral-400 transition hover:text-white">
            ← Back
          </Link>
          <h1 className="mt-4 font-heading text-3xl text-white">Settings</h1>
        </div>

        <ProfilePhotoSection />
        <BasicInformationSection
          initialUsername={username}
          initialFirstName={firstName}
          initialLastName={lastName}
          initialEmail={email}
        />
        <ChangePasswordSection />
      </div>
    </main>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-5">
      <h2 className="text-sm font-medium text-neutral-300">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ProfilePhotoSection() {
  return (
    <SectionCard title="Profile photo">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-xl text-neutral-600">
          ?
        </div>
        <div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg border border-neutral-800 px-4 py-2 text-xs text-neutral-600"
          >
            Upload photo
          </button>
          <p className="mt-2 text-xs text-neutral-500">Photo uploads aren&apos;t available yet.</p>
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
        <label className="text-xs text-neutral-400">
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
          <label className="flex-1 text-xs text-neutral-400">
            First name
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className={`${inputClass} mt-1 w-full`}
            />
          </label>
          <label className="flex-1 text-xs text-neutral-400">
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
          className="mt-1 self-start rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Update'}
        </button>
      </form>

      <div className="mt-6 border-t border-neutral-800 pt-4">
        <p className="text-xs text-neutral-400">Email address</p>
        <p className="mt-1 text-sm text-white">{initialEmail}</p>

        {!changingEmail ? (
          <button
            type="button"
            onClick={() => setChangingEmail(true)}
            className="mt-2 text-xs text-neutral-400 underline transition hover:text-white"
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
                className="rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
              >
                {emailLoading ? 'Sending…' : 'Update Email'}
              </button>
              <button
                type="button"
                onClick={() => setChangingEmail(false)}
                className="rounded-full border border-neutral-700 px-4 py-2 text-xs text-neutral-300 transition hover:border-neutral-500"
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
        <label className="text-xs text-neutral-400">
          Verify current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className={`${inputClass} mt-1 w-full`}
          />
        </label>

        <label className="text-xs text-neutral-400">
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
                className={`flex items-center gap-1.5 text-xs ${met ? 'text-emerald-400' : 'text-neutral-500'}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${met ? 'bg-emerald-400' : 'bg-neutral-700'}`} />
                {rule.label}
              </li>
            )
          })}
        </ul>

        <label className="text-xs text-neutral-400">
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
          className="mt-1 self-start rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update'}
        </button>
      </form>
    </SectionCard>
  )
}
