'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ClipboardList, AlertTriangle, LayoutGrid, Download } from 'lucide-react'
import { STATUS_CFG, PRIORITY_CFG, type WOStatus, type WOPriority } from '@/lib/wo-config'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

type WORow = {
  id: string
  order_number: string
  quantity: number
  status: WOStatus
  priority: WOPriority
  scheduled_end: string | null
  actual_end: string | null
  notes: string | null
  created_at: string
  products: { id: string; name: string; sku: string; unit: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function isOverdue(wo: WORow): boolean {
  if (!wo.scheduled_end) return false
  if (wo.status === 'done' || wo.status === 'cancelled') return false
  return new Date(wo.scheduled_end) < new Date()
}

function daysOver(d: string): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

const ALL = ''
const STATUS_OPTIONS: Array<[string, string]> = [
  [ALL, 'All Statuses'], ['queued', 'Queued'], ['in_progress', 'In Progress'],
  ['qc', 'QC Review'], ['done', 'Done'], ['cancelled', 'Cancelled'],
]
const PRIORITY_OPTIONS: Array<[string, string]> = [
  [ALL, 'All Priorities'], ['urgent', 'Urgent'], ['high', 'High'],
  ['medium', 'Medium'], ['low', 'Low'],
]

const SELECT = [
  'px-3 py-1.5 border border-gray-200 rounded-lg text-[12.5px] text-gray-600',
  'bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors',
].join(' ')

// ─── Page ─────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const router = useRouter()
  const [orders, setOrders]     = useState<WORow[]>([])
  const [loading, setLoading]   = useState(true)
  const [status,   setStatus]   = useState(ALL)
  const [priority, setPriority] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (status)   p.set('status',   status)
      if (priority) p.set('priority', priority)
      if (dateFrom) p.set('from',     dateFrom)
      if (dateTo)   p.set('to',       dateTo)

      const res = await fetch(`/api/work-orders?${p}`)
      if (!res.ok) throw new Error()
      setOrders(await res.json())
    } catch {
      toast.error('Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, [status, priority, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  function clearFilters() {
    setStatus(ALL); setPriority(ALL); setDateFrom(''); setDateTo('')
  }

  function exportCSV() {
    const headers = ['Order #', 'Product', 'SKU', 'Quantity', 'Unit', 'Priority', 'Status', 'Target Date', 'Actual End', 'Created']
    const rows = orders.map(wo => [
      wo.order_number,
      wo.products?.name ?? '',
      wo.products?.sku ?? '',
      wo.quantity,
      wo.products?.unit ?? '',
      wo.priority,
      wo.status,
      wo.scheduled_end?.slice(0, 10) ?? '',
      wo.actual_end?.slice(0, 10) ?? '',
      wo.created_at.slice(0, 10),
    ])

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)

    a.href     = url
    a.download = `work-orders-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasFilter = status || priority || dateFrom || dateTo
  const overdue   = orders.filter(isOverdue)

  return (
    <div className="space-y-4">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[13px] text-gray-500 shrink-0">
          {loading ? '' : `${orders.length} order${orders.length !== 1 ? 's' : ''}${overdue.length ? ` · ` : ''}`}
          {overdue.length > 0 && !loading && (
            <span className="text-red-500 font-medium">{overdue.length} overdue</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={loading || orders.length === 0}
            title={orders.length === 0 ? 'No orders to export' : `Export ${orders.length} order${orders.length !== 1 ? 's' : ''} as CSV`}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Download style={{ width: 14, height: 14 }} />
            Export CSV
          </button>
          <Link
            href="/work-orders/kanban"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-600 hover:border-primary hover:text-primary transition-colors"
          >
            <LayoutGrid style={{ width: 14, height: 14 }} />
            Kanban
          </Link>
          <button
            onClick={() => router.push('/work-orders/new')}
            className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-2 rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus style={{ width: 15, height: 15 }} />
            New Work Order
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 shrink-0">
          Filters
        </span>

        <select value={status}   onChange={e => setStatus(e.target.value)}   className={SELECT}>
          {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <select value={priority} onChange={e => setPriority(e.target.value)} className={SELECT}>
          {PRIORITY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <div className="flex items-center gap-1.5 text-[12.5px] text-gray-500">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className={SELECT + ' w-36'} />
          <span>to</span>
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}
            className={SELECT + ' w-36'} />
        </div>

        {hasFilter && (
          <button
            onClick={clearFilters}
            className="text-[12px] text-gray-400 hover:text-gray-700 transition-colors ml-auto underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

        {loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {['Order #', 'Product', 'Quantity', 'Priority', 'Status', 'Target Date', 'Created'].map(h => (
                    <th key={h} className="py-2.5 px-4 first:pl-5 last:pr-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className={i < 6 ? 'border-b border-gray-100' : ''}>
                    <td className="py-3.5 pl-5 pr-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 130 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 60 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 56 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 96 }} /></td>
                    <td className="py-3.5 px-4 pr-5"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center h-52 gap-2">
            <ClipboardList className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-400">
              {hasFilter ? 'No orders match these filters.' : 'No work orders yet.'}
            </p>
            {!hasFilter && (
              <button
                onClick={() => router.push('/work-orders/new')}
                className="text-[12px] text-primary hover:underline font-medium"
              >
                Create first work order →
              </button>
            )}
          </div>
        )}

        {!loading && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[
                    { l: 'Order #',     c: 'text-left pl-5 pr-4' },
                    { l: 'Product',     c: 'text-left px-4' },
                    { l: 'Quantity',    c: 'text-right px-4' },
                    { l: 'Priority',    c: 'text-left px-4' },
                    { l: 'Status',      c: 'text-left px-4' },
                    { l: 'Target Date', c: 'text-left px-4' },
                    { l: 'Created',     c: 'text-left px-4 pr-5' },
                  ].map(h => (
                    <th key={h.l} className={`py-2.5 ${h.c} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}>
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {orders.map((wo, i) => {
                  const overdue   = isOverdue(wo)
                  const statusCfg = STATUS_CFG[wo.status]
                  const priCfg    = PRIORITY_CFG[wo.priority]

                  return (
                    <tr
                      key={wo.id}
                      onClick={() => router.push(`/work-orders/${wo.id}`)}
                      className={[
                        'cursor-pointer transition-colors',
                        overdue ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-gray-50/60',
                        i < orders.length - 1 ? 'border-b border-gray-100' : '',
                      ].join(' ')}
                    >
                      {/* Order # */}
                      <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                        <span className="font-mono text-[13px] font-semibold text-primary">
                          {wo.order_number}
                        </span>
                      </td>

                      {/* Product */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-[13px] text-gray-800 font-medium">
                          {wo.products?.name ?? '—'}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-mono text-[13px] text-gray-600 tabular-nums">
                          {wo.quantity} {wo.products?.unit ?? ''}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold ${priCfg.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priCfg.dot }} />
                          {priCfg.label}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold ${statusCfg.cls}`}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusCfg.dot }} />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Target Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {wo.scheduled_end ? (
                          <div className="flex items-center gap-1.5">
                            {overdue && (
                              <AlertTriangle
                                className="text-red-400 shrink-0"
                                style={{ width: 12, height: 12 }}
                              />
                            )}
                            <span className={`text-[13px] ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {fmtDate(wo.scheduled_end)}
                              {overdue && (
                                <span className="text-[11px] ml-1 text-red-400">
                                  · {daysOver(wo.scheduled_end)}d over
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="py-3.5 px-4 pr-5 text-[12.5px] text-gray-400 whitespace-nowrap">
                        {fmtDate(wo.created_at)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
