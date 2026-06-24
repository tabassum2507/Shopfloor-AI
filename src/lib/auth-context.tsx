'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────

export type Profile = {
  id:         string
  full_name:  string | null
  role:       string | null
  created_at: string
}

type AuthContextValue = {
  user:    User    | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null, profile: null, loading: true,
  signOut: async () => {},
})

// ─── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User    | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  async function loadProfile(uid: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', uid)
      .single()
    setProfile(data ?? null)
  }

  useEffect(() => {
    const supabase = createClient()

    // 1. Validate the session server-side on mount (getUser() verifies the JWT,
    //    unlike getSession() which only reads the local cookie).
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null)
      if (u) loadProfile(u.id)
      setLoading(false)
    })

    // 2. Subscribe to auth state changes so the UI stays in sync when the token
    //    is refreshed, when the user signs out in another tab, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          loadProfile(u.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    router.push('/login')
    router.refresh()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext)
}
