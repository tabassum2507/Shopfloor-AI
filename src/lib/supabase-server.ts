import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Server client (Route Handlers & Server Components) ────────
// Reads the auth session from the request cookie jar so every Supabase
// call automatically carries the user's JWT.  RLS policies that require
// auth.role() = 'authenticated' will therefore work correctly.

export function db() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components can't mutate cookies — suppress the error.
          }
        },
      },
    }
  )
}
