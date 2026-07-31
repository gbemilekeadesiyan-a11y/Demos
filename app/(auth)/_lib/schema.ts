// Shared across features: anywhere a user is referenced in a return type,
// this carries their profile instead of a bare UUID. See public.profiles
// in supabase/migrations/002_profiles.sql — username/first_name/last_name.
// Anonymous users have no profiles row, so callers get null instead of a
// UserSummary rather than the query failing.
export type UserSummary = {
  id: string
  username: string
  firstName: string
  lastName: string
}

// Signup validation — see app/(auth)/signup/page.tsx for where these surface
// (live checklist while a field is focused, consolidated message on blur)
// and app/(auth)/_lib/actions.ts for the existence checks (username/email
// uniqueness) that run alongside these format checks.

export type ChecklistItem = { label: string; met: boolean }

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*]/
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MIN_ENTROPY_BITS = 50

// Same rule set drives three things: the live green-tick/red-cross checklist
// shown while a field is focused, the single consolidated message shown on
// blur, and the format gate in signUp() — one source of truth for all three.
export function getUsernameChecklist(username: string): ChecklistItem[] {
  return [
    {
      label: `${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`,
      met: username.length >= USERNAME_MIN_LENGTH && username.length <= USERNAME_MAX_LENGTH,
    },
    {
      label: 'Letters, numbers, underscores, and hyphens only',
      met: username.length > 0 && /^[a-zA-Z0-9_-]+$/.test(username),
    },
    {
      label: 'Cannot start with a number',
      met: username.length > 0 && !/^[0-9]/.test(username),
    },
  ]
}

// Rough Shannon-entropy estimate: password length times log2 of the size of
// the character pool actually drawn from (only counting classes present).
function estimatePasswordEntropyBits(password: string): number {
  let poolSize = 0
  if (/[a-z]/.test(password)) poolSize += 26
  if (/[A-Z]/.test(password)) poolSize += 26
  if (/[0-9]/.test(password)) poolSize += 10
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32

  if (poolSize === 0) return 0
  return password.length * Math.log2(poolSize)
}

export function getPasswordChecklist(password: string, username: string): ChecklistItem[] {
  const classesMet = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    SPECIAL_CHAR_PATTERN.test(password),
  ].filter(Boolean).length

  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: password.length >= PASSWORD_MIN_LENGTH },
    {
      label: 'Includes at least 3 of: uppercase, lowercase, number, special character (!@#$%^&*)',
      met: classesMet >= 3,
    },
    {
      label: "Isn't the same as your username",
      met: username.length === 0 || password.toLowerCase() !== username.toLowerCase(),
    },
    {
      label: 'Not easily guessable',
      met: estimatePasswordEntropyBits(password) >= PASSWORD_MIN_ENTROPY_BITS,
    },
  ]
}

// Collapses every unmet checklist item into the single message a field's
// blur-time pop-up shows.
export function summarizeUnmet(items: ChecklistItem[]): string | null {
  const unmet = items.filter((item) => !item.met)
  if (unmet.length === 0) return null
  return `Doesn't meet: ${unmet.map((item) => item.label).join(', ')}`
}

export function validateUsernameFormat(username: string): string | null {
  return summarizeUnmet(getUsernameChecklist(username))
}

export function validateEmailFormat(email: string): string | null {
  return EMAIL_PATTERN.test(email) ? null : 'Enter a valid email address'
}

const NAME_PATTERN = /^[a-zA-Z]+$/

export function validateNameFormat(name: string, fieldLabel: string): string | null {
  return NAME_PATTERN.test(name) ? null : `${fieldLabel} can only contain letters`
}

export function validatePassword(password: string, username: string): string | null {
  return summarizeUnmet(getPasswordChecklist(password, username))
}

export function getConfirmPasswordChecklist(password: string, confirmPassword: string): ChecklistItem[] {
  const matches = confirmPassword.length > 0 && confirmPassword === password
  return [{ label: matches ? 'Passwords match' : "Passwords don't match", met: matches }]
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  return confirmPassword === password ? null : "Passwords don't match"
}
