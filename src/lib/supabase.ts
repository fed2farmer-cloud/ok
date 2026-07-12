import { createClient, type Session, type User } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

const SESSION_REFRESH_BUFFER_MS = 60_000

function sessionNeedsRefresh(session: Session | null) {
  if (!session?.access_token) return true
  if (!session.expires_at) return false
  return session.expires_at * 1000 <= Date.now() + SESSION_REFRESH_BUFFER_MS
}

export async function getCurrentAuthContext(): Promise<{
  session: Session
  user: User
}> {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  const {
    data: { session: initialSession },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError) {
    throw sessionError
  }

  let session = initialSession

  if (sessionNeedsRefresh(session)) {
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession()

    if (refreshError || !refreshedSession) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    session = refreshedSession
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(session.access_token)

  if (userError || !user) {
    throw new Error('Your session has expired. Please sign in again.')
  }

  return { session, user }
}

export function getSupabaseErrorMessage(
  error: unknown,
  fallback = 'Something went wrong.'
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  if (!message) {
    return fallback
  }

  if (/jwt|token|session|refresh/i.test(message)) {
    return 'Your session expired. Please sign in again and retry.'
  }

  if (/row-level security|permission|not allowed|forbidden|unauthorized/i.test(message)) {
    return 'You do not have permission to access that document.'
  }

  return message
}