export function signUp(formData: {
  email: string
  firstName: string
  lastName: string
  username: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export function login(formData: {
  email: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export function signInAnonymously(): Promise<{ success: boolean; error?: string }> {
  throw new Error('not implemented')
}

export function joinSessionByCode(
  code: string
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  throw new Error('not implemented')
}
