'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Factory, Loader2, AlertCircle,
  Eye, EyeOff, LayoutDashboard, Bot, TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─── Tiny feature-highlight row ──────────────────────────────

function Feature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md flex items-center justify-center bg-white/10 shrink-0">
        <Icon style={{ width: 11, height: 11 }} className="text-amber-300" strokeWidth={2} />
      </div>
      <span className="text-[11.5px] text-white/60 leading-snug">{text}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : authError.message
      )
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>

      {/* ── Left panel — branding (md+) ── */}
      <div
        className="hidden md:flex flex-col justify-between p-10 w-[380px] shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E3A5F 0%, #142844 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10">
            <Factory className="text-amber-400" style={{ width: 16, height: 16 }} strokeWidth={1.75} />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">
            ShopFloor<span className="text-amber-400"> AI</span>
          </span>
        </div>

        {/* Hero copy */}
        <div className="space-y-6">
          <div>
            <h2 className="text-[26px] font-bold text-white leading-tight tracking-tight">
              Production tracking<br />for modern<br />manufacturers.
            </h2>
            <p className="mt-3 text-[13px] text-white/50 leading-relaxed">
              Real-time shop floor visibility, AI-powered insights, and predictive scheduling — all in one place.
            </p>
          </div>

          <div className="space-y-2.5">
            <Feature icon={LayoutDashboard} text="Live dashboard with KPIs and overdue alerts" />
            <Feature icon={Bot}             text="AI assistant that understands Hindi & English" />
            <Feature icon={TrendingUp}      text="At-risk order predictions before they miss deadlines" />
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-white/25">
          © {new Date().getFullYear()} ShopFloor AI · Portfolio Demo
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Mobile-only brand mark */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
              style={{ backgroundColor: '#1E3A5F' }}
            >
              <Factory className="text-amber-400" style={{ width: 20, height: 20 }} strokeWidth={1.75} />
            </div>
            <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">
              ShopFloor<span style={{ color: '#1E3A5F' }}> AI</span>
            </h1>
            <p className="text-[12px] text-gray-500 mt-0.5 text-center">
              Production tracking for modern manufacturers
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Accent top bar */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #1E3A5F, #2D6FA8)' }} />

            <div className="p-7">
              <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Welcome back</h2>
              <p className="text-[12.5px] text-gray-500 mt-0.5">Sign in to your account to continue</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                {/* Email */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50/60 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    style={{ '--tw-ring-color': '#1E3A5F33', '--tw-ring-offset-shadow': '0 0 #0000', '--tw-ring-shadow': '0 0 0 3px #1E3A5F22' } as React.CSSProperties}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="password">
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
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50/60 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                      style={{ '--tw-ring-color': '#1E3A5F33' } as React.CSSProperties}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword
                        ? <EyeOff style={{ width: 14, height: 14 }} />
                        : <Eye    style={{ width: 14, height: 14 }} />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" style={{ width: 13, height: 13 }} />
                    <p className="text-[12px] text-red-700 leading-snug">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-[13.5px] font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#1E3A5F' }}
                >
                  {loading && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          </div>

          {/* Sign-up link */}
          <p className="text-center text-[12.5px] text-gray-500 mt-5">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={{ color: '#1E3A5F' }}
            >
              Create one →
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}
