import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function db() {
  const store = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cs) => {
          try {
            cs.forEach(({ name, value, options }) => store.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}

export async function requireAuth() {
  const supabase = db()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return supabase
}

export async function checkAuth(): Promise<boolean> {
  return !!(await requireAuth())
}
