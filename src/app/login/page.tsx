'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Factory, Loader2, AlertCircle, Eye, EyeOff,
  Columns3, Mic, Package, BarChart3, Zap, Bot,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─── Feature bullet ───────────────────────────────────────────

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(251,191,36,0.15)' }}>
        <Icon style={{ width: 13, height: 13 }} className="text-amber-400" strokeWidth={2} />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-white/85 leading-tight">{title}</p>
        <p className="text-[11.5px] text-white/45 mt-0.5 leading-snug">{desc}</p>
      </div>
    </div>
  )
}

// ─── Dashboard preview mockup ─────────────────────────────────

function DashboardPreview() {
  return (
    <div className="mt-8 rounded-xl overflow-hidden border border-gray-200 shadow-lg bg-white" style={{ fontSize: 0 }}>
      {/* Fake topbar */}
      <div className="bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-300" />
        <div className="w-2 h-2 rounded-full bg-amber-300" />
        <div className="w-2 h-2 rounded-full bg-green-300" />
        <span className="ml-2 text-[9px] text-gray-400 font-mono">shopfloor-ai.vercel.app</span>
      </div>
      {/* Fake content */}
      <div className="flex" style={{ height: 120 }}>
        {/* Sidebar strip */}
        <div className="w-8 bg-[#1E3A5F] shrink-0 flex flex-col items-center pt-2 gap-2">
          {[BarChart3, Columns3, Package, Bot].map((Icon, i) => (
            <div key={i} className={`w-4 h-4 rounded flex items-center justify-center ${i === 0 ? 'bg-amber-400/20' : ''}`}>
              <Icon style={{ width: 8, height: 8 }} className={i === 0 ? 'text-amber-400' : 'text-white/30'} strokeWidth={2} />
            </div>
          ))}
        </div>
        {/* Main area */}
        <div className="flex-1 p-2 bg-[#F8FAFC]">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            {[
              { label: 'Active', val: '5', color: '#3B82F6' },
              { label: 'Overdue', val: '3', color: '#EF4444' },
              { label: 'Done', val: '2', color: '#10B981' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded p-1.5 border border-gray-100">
                <p className="text-[8px] text-gray-400">{k.label}</p>
                <p className="text-[12px] font-bold" style={{ color: k.color }}>{k.val}</p>
              </div>
            ))}
          </div>
          {/* Fake table rows */}
          {['WO-0037 · TMT Bar 16mm', 'WO-0038 · Angle Iron 50×50', 'WO-0039 · TMT Bar 12mm'].map((r, i) => (
            <div key={r} className="flex items-center gap-1.5 bg-white rounded px-1.5 py-1 border border-gray-100 mb-1">
              <span className="w-1 h-1 rounded-full shrink-0" style={{ background: i === 0 ? '#EF4444' : '#F59E0B' }} />
              <span className="text-[8px] text-gray-600 truncate flex-1">{r}</span>
              <span className="text-[7px] px-1 py-0.5 rounded font-semibold" style={{
                background: i === 0 ? '#FEE2E2' : '#FEF3C7',
                color: i === 0 ? '#B91C1C' : '#92400E',
              }}>
                {i === 0 ? 'Overdue' : 'At risk'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

const DEMO_EMAIL    = process.env.NEXT_PUBLIC_DEMO_EMAIL    ?? ''
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? ''

export default function LoginPage() {
  const router = useRouter()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [loading,      setLoading]      = useState(false)
  const [demoLoading,  setDemoLoading]  = useState(false)
  const [error,        setError]        = useState('')
  const [demoError,    setDemoError]    = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function signIn(e: string, p: string, isDemo = false) {
    if (isDemo) { setDemoLoading(true); setDemoError('') }
    else { setLoading(true); setError('') }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email: e, password: p })

    if (authError) {
      const msg = authError.message === 'Invalid login credentials'
        ? 'Incorrect email or password.'
        : authError.message
      if (isDemo) setDemoError(msg)
      else setError(msg)
      setLoading(false)
      setDemoLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    signIn(email, password)
  }

  function handleDemoLogin() {
    if (!DEMO_EMAIL || !DEMO_PASSWORD) {
      setDemoError('Demo credentials not configured — set NEXT_PUBLIC_DEMO_EMAIL and NEXT_PUBLIC_DEMO_PASSWORD in .env.local.')
      return
    }
    signIn(DEMO_EMAIL, DEMO_PASSWORD, true)
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#F8FAFC' }}>

      {/* ── Left panel — branding (md+) ── */}
      <div
        className="hidden md:flex flex-col justify-between p-10 w-[400px] shrink-0"
        style={{ background: 'linear-gradient(160deg, #1E3A5F 0%, #0F1E33 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.15)' }}>
            <Factory className="text-amber-400" style={{ width: 16, height: 16 }} strokeWidth={1.75} />
          </div>
          <span className="text-[15px] font-bold text-white tracking-tight">
            ShopFloor<span className="text-amber-400"> AI</span>
          </span>
        </div>

        {/* Hero copy */}
        <div className="space-y-7">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <Zap style={{ width: 10, height: 10 }} className="text-amber-400" />
              <span className="text-[10.5px] font-semibold text-amber-400 uppercase tracking-wider">AI-Powered MES</span>
            </div>
            <h2 className="text-[26px] font-bold text-white leading-tight tracking-tight">
              Production tracking<br />for modern<br />manufacturers.
            </h2>
            <p className="mt-3 text-[13px] text-white/45 leading-relaxed">
              AI-powered production tracking for modern manufacturers — real-time shop floor visibility in one place.
            </p>
          </div>

          <div className="space-y-4">
            <Feature
              icon={Columns3}
              title="Kanban production board"
              desc="Drag-and-drop work orders across queued, in-progress, QC, and done stages"
            />
            <Feature
              icon={Mic}
              title="AI assistant with voice"
              desc="Ask in Hindi or English — 'Aaj kitne orders pending hain?'"
            />
            <Feature
              icon={Package}
              title="Real-time inventory tracking"
              desc="Auto-deduct materials on completion, reorder alerts with live stock badges"
            />
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-white/25">
          © {new Date().getFullYear()} ShopFloor AI · Built by Tabassum Khanum
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-start justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm py-8">

          {/* Mobile-only brand mark */}
          <div className="flex flex-col items-center mb-7 md:hidden">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#1E3A5F' }}>
              <Factory className="text-amber-400" style={{ width: 20, height: 20 }} strokeWidth={1.75} />
            </div>
            <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">
              ShopFloor<span style={{ color: '#1E3A5F' }}> AI</span>
            </h1>
            <p className="text-[12px] text-gray-500 mt-0.5 text-center">
              AI-powered production tracking for modern manufacturers
            </p>
          </div>

          {/* ── Demo CTA — most prominent for Product Hunt ── */}
          <div className="rounded-2xl overflow-hidden mb-5" style={{ border: '1.5px solid rgba(251,191,36,0.5)', background: 'linear-gradient(135deg, #1E3A5F 0%, #142844 100%)' }}>
            <div className="px-5 pt-4 pb-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-400 mb-1">Try the live demo</p>
              <p className="text-[13px] text-white/70 leading-snug">
                Explore real manufacturing data — no sign-up needed.
              </p>
            </div>
            <div className="px-4 pb-4 pt-3 space-y-2">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={demoLoading || loading}
                className="w-full py-2.5 rounded-xl text-[13.5px] font-bold text-[#1E3A5F] transition-all flex items-center justify-center gap-2 disabled:opacity-60 hover:brightness-105 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', boxShadow: '0 4px 16px rgba(251,191,36,0.35)' }}
              >
                {demoLoading
                  ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />Signing in…</>
                  : <><Zap style={{ width: 14, height: 14 }} strokeWidth={2.5} />Enter as Demo User</>
                }
              </button>
              {demoError && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-400/20">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" style={{ width: 12, height: 12 }} />
                  <p className="text-[11.5px] text-red-300 leading-snug">{demoError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11.5px] text-gray-400">or sign in with your account</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="h-[3px]" style={{ background: 'linear-gradient(90deg, #1E3A5F, #2D6FA8)' }} />
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Email */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50/60 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-primary transition-all"
                    style={{ '--tw-ring-color': '#1E3A5F22' } as React.CSSProperties}
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
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50/60 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-primary transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
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

                <button
                  type="submit"
                  disabled={loading || demoLoading}
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
            <Link href="/signup" className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity" style={{ color: '#1E3A5F' }}>
              Create one →
            </Link>
          </p>

          {/* Dashboard preview */}
          <DashboardPreview />

          <p className="text-center text-[11px] text-gray-400 mt-3">
            Live preview of the ShopFloor AI dashboard
          </p>
        </div>
      </div>
    </div>
  )
}
