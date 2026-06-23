'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Factory, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function SignUpPage() {
  const router   = useRouter()
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // If email confirmation is disabled in Supabase settings, the user is
    // signed in immediately and the middleware will redirect to /.
    // If confirmation is required, show the "check your email" state.
    setSuccess(true)
    setLoading(false)
    setTimeout(() => { router.push('/'); router.refresh() }, 1500)
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
          <h2 className="text-[15px] font-semibold text-gray-800 mb-5">Create your account</h2>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle className="text-green-500" style={{ width: 36, height: 36 }} strokeWidth={1.5} />
              <p className="text-[13.5px] font-semibold text-gray-800">Account created!</p>
              <p className="text-[12.5px] text-gray-500 leading-snug">
                Taking you to the dashboard…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tabassum K"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-primary transition-all"
                />
              </div>

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
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-gray-600 mb-1.5" htmlFor="password">
                  Password <span className="font-normal text-gray-400">(min 6 characters)</span>
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
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-gray-50 text-[13.5px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:border-primary transition-all"
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
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[12.5px] text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline underline-offset-2">
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}
