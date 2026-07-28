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
