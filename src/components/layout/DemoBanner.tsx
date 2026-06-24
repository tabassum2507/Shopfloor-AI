'use client'

import { useState } from 'react'
import { X, RotateCcw, Loader2, AlertTriangle } from 'lucide-react'

export function DemoBanner() {
  const [hidden,      setHidden]      = useState(false)
  const [resetting,   setResetting]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (hidden) return null

  async function handleReset() {
    setShowConfirm(false)
    setResetting(true)
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Reset failed' }))
        throw new Error(error ?? 'Reset failed')
      }
      window.location.href = '/'
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reset failed — please try again.')
      setResetting(false)
    }
  }

  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-2 bg-amber-50 border-b border-amber-200/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 shrink-0">
            Portfolio Demo
          </span>
          <span className="text-amber-300 shrink-0">·</span>
          <span className="text-[12px] text-amber-800 truncate">
            Sample manufacturing data — changes persist to a real database.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={resetting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 text-[11.5px] font-medium transition-colors disabled:opacity-60 shadow-sm whitespace-nowrap"
          >
            {resetting
              ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
              : <RotateCcw style={{ width: 11, height: 11 }} />
            }
            {resetting ? 'Resetting…' : 'Reset Demo Data'}
          </button>
          <button
            onClick={() => setHidden(true)}
            aria-label="Dismiss banner"
            className="p-1 rounded text-amber-400 hover:text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* ── Confirmation modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setShowConfirm(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden animate-fadeIn">
            {/* Top accent */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }} />

            <div className="p-6">
              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="text-amber-500" style={{ width: 16, height: 16 }} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-bold text-gray-900">Reset Demo Data?</h3>
                  <p className="text-[11.5px] text-gray-400">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-[13px] text-gray-600 leading-relaxed">
                All current work orders, inventory changes, and transactions will be deleted and replaced with the original sample data.
              </p>

              <div className="flex gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2 rounded-lg text-[13px] font-semibold text-white transition-colors"
                  style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
                >
                  Yes, Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
