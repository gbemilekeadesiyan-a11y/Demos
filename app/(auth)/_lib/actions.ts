'use server'

import { createClient } from '../../../lib/supabase/server'
import { createAdminClient } from '../../../lib/supabase/admin'
import {
  validateConfirmPassword,
  validateEmailFormat,
  validateNameFormat,
  validatePassword,
  validateUsernameFormat,
} from './schema'

export type SignUpResult =
  | { success: true }
  | {
      success: false
      field?: 'firstName' | 'lastName' | 'username' | 'email' | 'password' | 'confirmPassword'
      error: string
    }

export async function signUp(formData: {
  email: string
  firstName: string
  lastName: string
  username: string
  password: string
  confirmPassword: string
}): Promise<SignUpResult> {
  const firstNameError = validateNameFormat(formData.firstName, 'First name')
  if (firstNameError) {
    return { success: false, field: 'firstName', error: firstNameError }
  }

  const lastNameError = validateNameFormat(formData.lastName, 'Last name')
  if (lastNameError) {
    return { success: false, field: 'lastName', error: lastNameError }
  }

  const usernameFormatError = validateUsernameFormat(formData.username)
  if (usernameFormatError) {
    return { success: false, field: 'username', error: usernameFormatError }
  }

  const emailFormatError = validateEmailFormat(formData.email)
  if (emailFormatError) {
    return { success: false, field: 'email', error: emailFormatError }
  }

  const passwordError = validatePassword(formData.password, formData.username)
  if (passwordError) {
    return { success: false, field: 'password', error: passwordError }
  }

  const confirmPasswordError = validateConfirmPassword(formData.password, formData.confirmPassword)
  if (confirmPasswordError) {
    return { success: false, field: 'confirmPassword', error: confirmPasswordError }
  }

  const supabase = await createClient()

  // profiles is select-able by everyone (002_profiles.sql), so this can be
  // queried directly rather than needing a security-definer RPC like the
  // email lookup below (auth.users isn't exposed via the REST API).
  const { data: existingUsername } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', formData.username)
    .maybeSingle()

  if (existingUsername) {
    return { success: false, field: 'username', error: 'That username is already taken' }
  }

  const { data: emailExists, error: emailLookupError } = await supabase.rpc('email_exists', {
    p_email: formData.email,
  })

  if (!emailLookupError && emailExists) {
    return { success: false, field: 'email', error: 'An account with this email already exists' }
  }

  // Keys here must match what handle_new_user() reads from
  // raw_user_meta_data in supabase/migrations/002_profiles.sql.
  const { error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        first_name: formData.firstName,
        last_name: formData.lastName,
        username: formData.username,
      },
    },
  })

  if (error) {
    if (error.code === 'user_already_exists') {
      return { success: false, field: 'email', error: 'An account with this email already exists' }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function login(formData: {
  email: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  })

  if (error) {
    if (error.code === 'email_not_confirmed') {
      return { success: false, error: 'Please verify your email before logging in' }
    }

    if (error.code === 'invalid_credentials') {
      // Supabase intentionally returns the same generic error for both
      // "no account" and "wrong password" (anti-enumeration). We split
      // them back apart with a dedicated lookup — see
      // supabase/migrations/004_auth_email_lookup.sql.
      const { data: emailExists, error: lookupError } = await supabase.rpc('email_exists', {
        p_email: formData.email,
      })

      if (!lookupError && emailExists === false) {
        return { success: false, error: 'There is no account registered with this Email' }
      }

      return { success: false, error: 'Password incorrect. Please try again' }
    }

    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function signInAnonymously(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInAnonymously()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function joinSessionByCode(
  code: string
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  throw new Error('not implemented')
}

export async function updateProfile(formData: {
  username?: string
  firstName?: string
  lastName?: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const patch: { username?: string; first_name?: string; last_name?: string } = {}
  if (formData.username !== undefined) patch.username = formData.username
  if (formData.firstName !== undefined) patch.first_name = formData.firstName
  if (formData.lastName !== undefined) patch.last_name = formData.lastName

  if (Object.keys(patch).length === 0) {
    return { success: true }
  }

  // profiles.username has a unique constraint (002_profiles.sql) — a
  // conflicting update fails as a unique_violation, not a generic error.
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'That username is already taken' }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function changePassword(formData: {
  currentPassword: string
  newPassword: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return { success: false, error: 'Not authenticated' }
  }

  // Supabase's updateUser() changes the password for the current session
  // without itself checking the old one — re-authenticate first so a
  // stolen/left-open session can't silently change the password.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: formData.currentPassword,
  })

  if (verifyError) {
    return { success: false, error: 'Current password is incorrect' }
  }

  const { error } = await supabase.auth.updateUser({ password: formData.newPassword })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function updateEmail(newEmail: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  // Supabase sends a confirmation link to the new address rather than
  // changing it immediately — the email only updates once that's clicked.
  const { error } = await supabase.auth.updateUser({ email: newEmail })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function deleteAccount(confirmation: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()

  if (!profile) {
    return { success: false, error: 'Could not verify your account' }
  }

  // GitHub-style confirmation — the caller must already have gated the
  // button on this client-side, this is the server-side check that
  // actually matters.
  if (confirmation !== profile.username) {
    return { success: false, error: 'Confirmation does not match your username' }
  }

  // shouldSoftDelete: true — bans the auth.users row rather than removing
  // it, so workspaces.created_by / voting_sessions.created_by (on delete
  // set null, see supabase/migrations/008_user_deletion_safety.sql) never
  // actually need to fire; this account can't cascade-destroy data other
  // people still need. Requires the service-role client — the anon-key
  // client can't call auth.admin.*.
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id, true)

  if (error) {
    return { success: false, error: error.message }
  }

  await supabase.auth.signOut()

  return { success: true }
}
