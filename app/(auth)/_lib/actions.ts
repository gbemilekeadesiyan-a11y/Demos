'use server'

import { createClient } from '../../../lib/supabase/server'

export async function signUp(formData: {
  email: string
  firstName: string
  lastName: string
  username: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

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

export async function joinSessionByCode(
  code: string
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  throw new Error('not implemented')
}
