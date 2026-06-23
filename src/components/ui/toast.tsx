'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type ToastType  = 'success' | 'error' | 'info'
type ToastEntry = { id: number; message: string; type: ToastType }

// Module-level ref — wired up once by <Toaster /> on mount.
// Calling toast() before Toaster mounts is a silent no-op.
let _push: ((message: string, type: ToastType) => void) | null = null

export function toast(message: string, type: ToastType = 'success') {
  _push?.(message, type)
}
toast.success = (message: string) => toast(message, 'success')
toast.error   = (message: string) => toast(message, 'error')
toast.info    = (message: string) => toast(message, 'info')

const ICON = {
  success: <CheckCircle2 className="shrink-0 text-green-500" style={{ width: 15, height: 15 }} />,
  error:   <XCircle      className="shrink-0 text-red-500"   style={{ width: 15, height: 15 }} />,
  info:    <Info         className="shrink-0 text-blue-500"  style={{ width: 15, height: 15 }} />,
}

const BORDER = { success: 'border-green-200', error: 'border-red-200', info: 'border-blue-200' }

export function Toaster() {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  useEffect(() => {
    _push = (message, type) => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
    }
    return () => { _push = null }
  }, [])

  if (!toasts.length) return null

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 bg-white border ${BORDER[t.type]} rounded-lg shadow-lg px-4 py-3 min-w-[260px] max-w-sm text-[13px] text-gray-700`}
        >
          {ICON[t.type]}
          <span className="flex-1">{t.message}</span>
          <button
            aria-label="Dismiss"
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="ml-1 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      ))}
    </div>
  )
}
