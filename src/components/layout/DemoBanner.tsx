'use client'

import { useState } from 'react'
import { X, RotateCcw, Loader2 } from 'lucide-react'

export function DemoBanner() {
  const [hidden,    setHidden]    = useState(false)
  const [resetting, setResetting] = useState(false)

  if (hidden) return null

  async function handleReset() {
    if (!confirm('Reset all data to the original demo state?\n\nThis will delete any changes you made and restore the original sample work orders, products, and inventory.')) return
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
    <div className="shrink-0 flex items-center justify-between gap-4 px-5 py-2 bg-amber-50 border-b border-amber-200/80">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 shrink-0">
          Portfolio Demo
        </span>
        <span className="text-amber-300 shrink-0">·</span>
        <span className="text-[12px] text-amber-800 truncate">
          Sample manufacturing data — changes persist to a real Supabase database.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-amber-200 hover:bg-amber-50 text-amber-800 text-[11.5px] font-medium transition-colors disabled:opacity-60 shadow-sm whitespace-nowrap"
        >
          {resetting
            ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
            : <RotateCcw style={{ width: 11, height: 11 }} />
          }
          Reset Demo Data
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
  )
}
