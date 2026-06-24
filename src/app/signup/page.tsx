'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Factory, Loader2, AlertCircle,
  Eye, EyeOff, Mail, CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────

const ROLES = [
  { value: 'planner',    label: 'Production Planner'  },
  { value: 'supervisor', label: 'Floor Supervisor'     },
  { value: 'manager',    label: 'Plant Manager'        },
]

const FIELD = [
  'w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50/60',
  'text-[13.5px] text-gray-800 placeholder:text-gray-300',
  'focus:outline-none focus:ring-2 focus:border-transparent transition-all',
].join(' ')

// ─── Page ─────────────────────────────────────────────────────

export default function SignUpPage() {
  const [name,            setName]            = useState('')
  const [email,           setEmail]           = useState('')
  const [role,            setRole]            = useState('planner')
  const [password,        setPassword]        = useState('')
  const [confirm,         setConfirm]         = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState(false)
  const [showPassword,    setShowPassword]    = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name.trim(),
          role,
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F8FAFC' }}>
      <div className="w-full max-w-sm">

        {/* Brand mark */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
            style={{ backgroundColor: '#1E3A5F' }}
          >
            <Factory className="text-amber-400" style={{ width: 20, height: 20 }} strokeWidth={1.75} />
          </div>
          <h1 className="text-[17px] font-bold text-gray-900 tracking-tight">
            ShopFloor<span style={{ color: '#1E3A5F' }}> AI</span>
          </h1>
          <p className="text-[12px] text-gray-500 mt-0.5">Production tracking for modern manufacturers</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Accent top bar */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #1E3A5F, #2D6FA8)' }} />

          <div className="p-7">

            {/* ── Success state ── */}
            {success ? (
              <div className="flex flex-col items-center text-center py-4 gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: '#EEF4FB' }}
                >
                  <Mail style={{ width: 24, height: 24, color: '#1E3A5F' }} strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-[16px] font-bold text-gray-900">Check your email</h2>
                  <p className="text-[12.5px] text-gray-500 mt-1.5 leading-relaxed">
                    We sent a confirmation link to{' '}
                    <span className="font-semibold text-gray-700 break-all">{email}</span>.
                    <br />Click it to activate your account.
                  </p>
                </div>
                <div className="w-full p-3 rounded-lg bg-blue-50 border border-blue-100 text-left">
                  <div className="flex gap-2">
                    <CheckCircle className="text-blue-500 shrink-0 mt-0.5" style={{ width: 13, height: 13 }} />
                    <p className="text-[12px] text-blue-700 leading-snug">
                      After confirming, you can sign in with your email and password.
                    </p>
                  </div>
                </div>
                <Link
                  href="/login"
                  className="w-full py-2.5 rounded-lg text-[13.5px] font-semibold text-white flex items-center justify-center transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#1E3A5F' }}
                >
                  Go to Sign In
                </Link>
              </div>

            ) : (
              /* ── Form ── */
              <>
                <h2 className="text-[17px] font-bold text-gray-900 tracking-tight">Create your account</h2>
                <p className="text-[12.5px] text-gray-500 mt-0.5">Join your team on ShopFloor AI</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">

                  {/* Full Name */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="name">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      autoFocus
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your full name"
                      className={FIELD}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="email">
                      Work email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className={FIELD}
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="role">
                      Your role
                    </label>
                    <select
                      id="role"
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className={FIELD + ' bg-white cursor-pointer'}
                    >
                      {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Password + Confirm — side by side on wider cards */}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="password">
                        Password
                        <span className="ml-1 font-normal text-gray-400">(min 6 chars)</span>
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className={FIELD + ' pr-10'}
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

                    <div>
                      <label className="block text-[11.5px] font-semibold text-gray-600 mb-1.5" htmlFor="confirm">
                        Confirm password
                      </label>
                      <div className="relative">
                        <input
                          id="confirm"
                          type={showConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          value={confirm}
                          onChange={e => setConfirm(e.target.value)}
                          placeholder="••••••••"
                          className={[
                            FIELD + ' pr-10',
                            confirm && password !== confirm
                              ? 'border-red-300 bg-red-50/30'
                              : confirm && password === confirm
                                ? 'border-green-300 bg-green-50/20'
                                : '',
                          ].join(' ')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(v => !v)}
                          tabIndex={-1}
                          aria-label={showConfirm ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showConfirm
                            ? <EyeOff style={{ width: 14, height: 14 }} />
                            : <Eye    style={{ width: 14, height: 14 }} />}
                        </button>
                      </div>
                      {confirm && password !== confirm && (
                        <p className="mt-1 text-[11px] text-red-500">Passwords don&apos;t match</p>
                      )}
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
                    disabled={loading || (!!confirm && password !== confirm)}
                    className="w-full py-2.5 rounded-lg text-[13.5px] font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#1E3A5F' }}
                  >
                    {loading && <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />}
                    {loading ? 'Creating account…' : 'Create account'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Sign-in link */}
        {!success && (
          <p className="text-center text-[12.5px] text-gray-500 mt-5">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={{ color: '#1E3A5F' }}
            >
              Sign in →
            </Link>
          </p>
        )}

      </div>
    </div>
  )
}
