'use client'

import { useState, type FormEvent } from 'react'
import { Logo } from '@/components/Logo'
import { signUp } from '../_lib/actions'
import {
  getConfirmPasswordChecklist,
  getPasswordChecklist,
  getUsernameChecklist,
  summarizeUnmet,
  validateEmailFormat,
  validateNameFormat,
} from '../_lib/schema'

type ValidatedField = 'firstName' | 'lastName' | 'username' | 'email' | 'password' | 'confirmPassword'

// First and last name share one pop-up (anchored to the right of the last
// name box) rather than each getting its own, so 'name' stands in for
// either field when deciding who currently owns that pop-up.
type PopupOwner = 'name' | 'username' | 'email' | 'password' | 'confirmPassword'

function popupOwnerFor(field: ValidatedField): PopupOwner {
  return field === 'firstName' || field === 'lastName' ? 'name' : field
}

type FieldErrors = {
  firstName?: string
  lastName?: string
  username?: string
  email?: string
  password?: string
  confirmPassword?: string
  surfaces?: string
  general?: string
}

export default function SignupPage() {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: '',
  })
  const [surfaces, setSurfaces] = useState({ ff: false, workspaces: false })
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [focusedField, setFocusedField] = useState<'username' | 'password' | 'confirmPassword' | null>(null)
  // The one field (or the name group) currently allowed to show its error
  // as a floating pop-up — every other invalid field just gets a red
  // border. Set on blur/submit-failure, cleared the moment a *different*
  // field/group gains focus.
  const [errorPopupField, setErrorPopupField] = useState<PopupOwner | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function updateField(field: ValidatedField, value: string) {
    setForm({ ...form, [field]: value })
    // Clear a field's error as soon as the user starts fixing it, rather
    // than leaving a stale pop-up up until the next submit attempt.
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function fieldMessage(field: ValidatedField, value: string): string | null {
    if (field === 'firstName') return validateNameFormat(value, 'First name')
    if (field === 'lastName') return validateNameFormat(value, 'Last name')
    if (field === 'username') return summarizeUnmet(getUsernameChecklist(value))
    if (field === 'password') return summarizeUnmet(getPasswordChecklist(value, form.username))
    if (field === 'confirmPassword') return summarizeUnmet(getConfirmPasswordChecklist(form.password, value))
    return validateEmailFormat(value)
  }

  // Combines both name fields into the single message the shared pop-up
  // shows, naming whichever of first/last (or both) is currently invalid.
  function nameGroupMessage(): string | null {
    const firstBad = form.firstName.length > 0 && fieldMessage('firstName', form.firstName) !== null
    const lastBad = form.lastName.length > 0 && fieldMessage('lastName', form.lastName) !== null
    if (firstBad && lastBad) return 'First and last name can only contain letters'
    if (firstBad) return 'First name can only contain letters'
    if (lastBad) return 'Last name can only contain letters'
    return null
  }

  function handleFocus(field: ValidatedField) {
    if (field === 'username' || field === 'password' || field === 'confirmPassword') setFocusedField(field)
    // Opening a different field/group hides the previous pop-up — it
    // keeps its red border (computed live below) but loses the message box.
    const owner = popupOwnerFor(field)
    setErrorPopupField((prev) => (prev && prev !== owner ? null : prev))
  }

  function handleBlur(field: ValidatedField) {
    if (field === 'username' || field === 'password' || field === 'confirmPassword') {
      setFocusedField((f) => (f === field ? null : f))
    }

    const owner = popupOwnerFor(field)
    const value = form[field]
    // Leaving a box empty isn't treated as an error to surface.
    const fieldLevelMessage = value.length === 0 ? null : fieldMessage(field, value)
    setFieldErrors((prev) => ({ ...prev, [field]: fieldLevelMessage ?? undefined }))

    // For the name group, re-check both fields live (not just the one that
    // was just blurred) so "both" is reported correctly.
    const popupMessage = owner === 'name' ? nameGroupMessage() : fieldLevelMessage

    setErrorPopupField((prev) => {
      if (popupMessage) return owner
      return prev === owner ? null : prev
    })
  }

  function isFieldInvalid(field: ValidatedField): boolean {
    const value = form[field]
    if (value.length === 0) return false
    return Boolean(fieldErrors[field]) || fieldMessage(field, value) !== null
  }

  function borderClass(field: ValidatedField): string {
    return isFieldInvalid(field) ? 'border-red-400' : 'border-border'
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setFieldErrors({})
    setErrorPopupField(null)

    if (!surfaces.ff && !surfaces.workspaces) {
      setLoading(false)
      setFieldErrors({ surfaces: 'Pick at least one to continue.' })
      return
    }

    const result = await signUp({ ...form, surfaces })

    setLoading(false)

    if (!result.success) {
      if (result.field === 'surfaces') {
        setFieldErrors({ surfaces: result.error })
      } else if (result.field) {
        setFieldErrors({ [result.field]: result.error })
        setErrorPopupField(popupOwnerFor(result.field))
      } else {
        setFieldErrors({ general: result.error ?? 'Something went wrong. Please try again.' })
      }
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <Logo className="mx-auto mb-6 h-8 w-auto text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            We sent a verification link to {form.email}. Click it to activate your account.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-6 h-8 w-auto text-foreground" />
          <h1 className="text-2xl font-semibold text-foreground">Create your account</h1>
          <p className="mt-2 text-sm text-muted">Join dēmos to create and vote on sessions.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="w-1/2">
              <input
                type="text"
                placeholder="First name"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                onFocus={() => handleFocus('firstName')}
                onBlur={() => handleBlur('firstName')}
                required
                className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong ${borderClass('firstName')}`}
              />
            </div>
            <div className="relative w-1/2">
              <input
                type="text"
                placeholder="Last name"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                onFocus={() => handleFocus('lastName')}
                onBlur={() => handleBlur('lastName')}
                required
                className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong ${borderClass('lastName')}`}
              />
              {/* Shared pop-up for both name fields, anchored to the right
                  of the last-name box — first name has no room to its own
                  right without covering this one. */}
              {errorPopupField === 'name' && nameGroupMessage() && (
                <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-red-400/40 bg-surface p-2 text-xs text-red-400 shadow-lg">
                  {nameGroupMessage()}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={(e) => updateField('username', e.target.value)}
              onFocus={() => handleFocus('username')}
              onBlur={() => handleBlur('username')}
              required
              className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong ${borderClass('username')}`}
            />
            {focusedField === 'username' && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
                <ul className="space-y-1">
                  {getUsernameChecklist(form.username).map((item) => (
                    <li
                      key={item.label}
                      className={`flex items-center gap-2 ${item.met ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      <span aria-hidden="true">{item.met ? '✓' : '✗'}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errorPopupField === 'username' && focusedField !== 'username' && fieldErrors.username && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-red-400/40 bg-surface p-2 text-xs text-red-400 shadow-lg">
                {fieldErrors.username}
              </div>
            )}
          </div>

          <div className="relative">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              onFocus={() => handleFocus('email')}
              onBlur={() => handleBlur('email')}
              required
              className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong ${borderClass('email')}`}
            />
            {errorPopupField === 'email' && fieldErrors.email && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-red-400/40 bg-surface p-2 text-xs text-red-400 shadow-lg">
                {fieldErrors.email}
              </div>
            )}
          </div>

          <div className="relative">
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              onFocus={() => handleFocus('password')}
              onBlur={() => handleBlur('password')}
              required
              className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong ${borderClass('password')}`}
            />
            {focusedField === 'password' && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
                <ul className="space-y-1">
                  {getPasswordChecklist(form.password, form.username).map((item) => (
                    <li
                      key={item.label}
                      className={`flex items-center gap-2 ${item.met ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      <span aria-hidden="true">{item.met ? '✓' : '✗'}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errorPopupField === 'password' && focusedField !== 'password' && fieldErrors.password && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-red-400/40 bg-surface p-2 text-xs text-red-400 shadow-lg">
                {fieldErrors.password}
              </div>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Confirm password"
              value={form.confirmPassword}
              onChange={(e) => updateField('confirmPassword', e.target.value)}
              onFocus={() => handleFocus('confirmPassword')}
              onBlur={() => handleBlur('confirmPassword')}
              required
              className={`w-full rounded-lg border bg-surface px-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-border-strong ${borderClass('confirmPassword')}`}
            />
            {focusedField === 'confirmPassword' && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
                <ul className="space-y-1">
                  {getConfirmPasswordChecklist(form.password, form.confirmPassword).map((item) => (
                    <li
                      key={item.label}
                      className={`flex items-center gap-2 ${item.met ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      <span aria-hidden="true">{item.met ? '✓' : '✗'}</span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {errorPopupField === 'confirmPassword' && focusedField !== 'confirmPassword' && fieldErrors.confirmPassword && (
              <div className="absolute left-full top-0 z-20 ml-2 w-64 rounded-lg border border-red-400/40 bg-surface p-2 text-xs text-red-400 shadow-lg">
                {fieldErrors.confirmPassword}
              </div>
            )}
          </div>

          <div className="mt-2">
            <p className="mb-2 text-left text-sm font-medium text-muted">Where do you want to use dēmos?</p>
            <div className="flex flex-col gap-2">
              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  surfaces.ff ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <input
                  type="checkbox"
                  checked={surfaces.ff}
                  onChange={(e) => {
                    setSurfaces((prev) => ({ ...prev, ff: e.target.checked }))
                    setFieldErrors((prev) => ({ ...prev, surfaces: undefined }))
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border-strong bg-surface"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">dēmos Friends &amp; Family</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Casual, always-public polls with your friends and family.
                  </span>
                </span>
              </label>
              <label
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                  surfaces.workspaces
                    ? 'border-accent bg-accent/5'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <input
                  type="checkbox"
                  checked={surfaces.workspaces}
                  onChange={(e) => {
                    setSurfaces((prev) => ({ ...prev, workspaces: e.target.checked }))
                    setFieldErrors((prev) => ({ ...prev, surfaces: undefined }))
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-border-strong bg-surface"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">dēmos Workspaces</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Private sessions, member roles, and admin controls for your team.
                  </span>
                </span>
              </label>
            </div>
            {fieldErrors.surfaces && <p className="mt-2 text-xs text-red-400">{fieldErrors.surfaces}</p>}
          </div>

          {fieldErrors.general && <p className="text-sm text-red-400">{fieldErrors.general}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Continue'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <a href="/login" className="text-foreground underline">
            Log in
          </a>
        </p>
      </div>
    </main>
  )
}
