'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Factory, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // The SSR browser client set the session cookie — the middleware will now
    // see the user as authenticated and allow access to the dashboard.
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F0F4F8' }}>
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 shadow-sm"
            style={{ backgroundColor: '#1E3A5F' }}
          >
            <Factory className="text-amber-400" style={{ width: 22, height: 22 }} strokeWidth={1.75} />
          </div>
          <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">ShopFloor AI</h1>
          <p className="text-[12.5px] text-gray-500 mt-0.5">Manufacturing Execution System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7">
          <h2 className="text-[15px] font-semibold text-gray-800 mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-primary transition-all"
                style={{ '--tw-ring-color': '#1E3A5F40' } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-gray-600 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-primary transition-all"
                  style={{ '--tw-ring-color': '#1E3A5F40' } as React.CSSProperties}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 15, height: 15 }} />
                    : <Eye    style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                <AlertCircle className="text-red-500 shrink-0 mt-0.5" style={{ width: 14, height: 14 }} />
                <p className="text-[12.5px] text-red-700 leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-[13.5px] font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              style={{ backgroundColor: '#1E3A5F' }}
            >
              {loading && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Sign-up link */}
        <p className="text-center text-[12.5px] text-gray-500 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-primary hover:underline underline-offset-2">
            Create one
          </Link>
        </p>

      </div>
    </div>
  )
}
