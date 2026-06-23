'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Clock, PlayCircle, ShieldCheck, CheckCircle2,
  AlertTriangle, RefreshCcw, CheckCircle, TrendingUp, FileText,
} from 'lucide-react'
import MetricCard from '@/components/MetricCard'
import ProductionBarChart, { type BarDay } from '@/components/charts/ProductionBarChart'
import PriorityDonutChart, { type DonutSlice } from '@/components/charts/PriorityDonutChart'
import { useHeaderRight } from '@/lib/header-context'
import { toast } from '@/components/ui/toast'
import { PRIORITY_CFG, STATUS_CFG, type WOPriority, type WOStatus } from '@/lib/wo-config'

// ─── Types ────────────────────────────────────────────────────

type Summary = {
  queued: number
  inProgress: number
  qc: number
  completedToday: number
}

type OverdueOrder = {
  id: string
  order_number: string
  quantity: number
  status: WOStatus
  priority: WOPriority
  scheduled_end: string
  products: { name: string; unit: string } | null
  days_overdue: number
}

type AtRiskOrder = {
  id: string
  order_number: string
  product: string
  status: string
  target_date: string
  predicted_end_date: string
  days_at_risk: number
  basis: 'product' | 'global' | 'fallback'
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const REFRESH_MS = 30_000

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonMetric() {
  return (
    <div className="bg-white rounded-lg border border-gray-100 border-l-4 border-l-gray-200 shadow-sm p-5 flex items-center gap-4 animate-pulse">
      <div className="flex-1">
        <div className="h-2 w-20 bg-gray-100 rounded mb-4" />
        <div className="h-8 w-10 bg-gray-100 rounded" />
      </div>
      <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const { setHeaderRight } = useHeaderRight()

  const [summary,     setSummary]     = useState<Summary | null>(null)
  const [weekly,      setWeekly]      = useState<BarDay[]>([])
  const [priority,    setPriority]    = useState<DonutSlice[]>([])
  const [overdue,     setOverdue]     = useState<OverdueOrder[]>([])
  const [atRisk,      setAtRisk]      = useState<AtRiskOrder[]>([])
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const isFirstLoad = useRef(true)

  // ── Fetch all dashboard data ──────────────────────────────

  const loadAll = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true)
    try {
      const [sumData, weekData, priData, overdueData, riskData] = await Promise.all([
        fetch('/api/dashboard/summary').then(r => r.json()),
        fetch('/api/dashboard/weekly').then(r => r.json()),
        fetch('/api/dashboard/priority').then(r => r.json()),
        fetch('/api/dashboard/overdue').then(r => r.json()),
        fetch('/api/dashboard/at-risk').then(r => r.json()),
      ])
      setSummary(sumData)
      setWeekly(weekData)
      setPriority(priData)
      setOverdue(overdueData)
      setAtRisk(Array.isArray(riskData) ? riskData : [])
      setLastUpdated(new Date())
    } catch {
      toast.error('Failed to load dashboard data')
    } finally {
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-refresh every 30 s; data updates in-place without showing skeletons
  useEffect(() => {
    const id = setInterval(loadAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [loadAll])

  // ── Inject "last updated" + Refresh into the AppShell top bar ──

  useEffect(() => {
    if (!lastUpdated) return
    setHeaderRight(
      <div className="flex items-center gap-3">
        <span className="hidden sm:flex items-center gap-1.5 text-[12px] text-gray-400 tabular-nums">
          <Clock style={{ width: 11, height: 11 }} />
          {lastUpdated.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </span>
        <button
          onClick={() => window.open('/api/report/daily', '_blank')}
          className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-primary border border-gray-200 hover:border-primary/40 px-2.5 py-1.5 rounded-lg transition-colors"
          title="Open daily production report (printable)"
        >
          <FileText style={{ width: 12, height: 12 }} />
          <span className="hidden sm:inline">Daily Report</span>
        </button>
        <button
          onClick={loadAll}
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-primary transition-colors"
          title="Refresh dashboard"
        >
          <RefreshCcw style={{ width: 12, height: 12 }} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    )
  }, [lastUpdated, setHeaderRight, loadAll])

  // Clear slot on unmount (when navigating away from Dashboard)
  useEffect(() => {
    return () => setHeaderRight(null)
  }, [setHeaderRight])

  // ── Metric config ─────────────────────────────────────────

  const metrics = summary
    ? [
        { title: 'Queued',          count: summary.queued,         Icon: Clock,        accent: '#F59E0B' },
        { title: 'In Progress',     count: summary.inProgress,     Icon: PlayCircle,   accent: '#3B82F6' },
        { title: 'In QC',           count: summary.qc,             Icon: ShieldCheck,  accent: '#8B5CF6' },
        { title: 'Completed Today', count: summary.completedToday, Icon: CheckCircle2, accent: '#10B981' },
      ]
    : null

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !metrics
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonMetric key={i} />)
          : metrics.map(m => <MetricCard key={m.title} {...m} />)
        }
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Weekly production bar chart */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[13px] font-semibold text-gray-700">Weekly Production Output</h2>
            <span className="text-[11px] text-gray-400">last 7 days · tonnes</span>
          </div>
          {loading
            ? (
              <div className="h-[232px] flex items-end gap-2 px-2 pb-4 animate-pulse">
                {[55, 72, 40, 88, 35, 92, 60].map((h, i) => (
                  <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
                ))}
              </div>
            )
            : <ProductionBarChart data={weekly} />
          }
        </div>

        {/* Priority donut */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-[13px] font-semibold text-gray-700">Orders by Priority</h2>
            <span className="text-[11px] text-gray-400">active orders</span>
          </div>
          {loading
            ? (
              <div className="h-[232px] flex items-center justify-center animate-pulse">
                <div className="relative w-36 h-36">
                  <div className="absolute inset-0 rounded-full border-[22px] border-gray-100" />
                  <div className="absolute inset-[22px] rounded-full bg-white" />
                </div>
              </div>
            )
            : <PriorityDonutChart data={priority} />
          }
        </div>
      </div>

      {/* ── Overdue orders table ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <AlertTriangle
            className="text-red-500 shrink-0"
            style={{ width: 14, height: 14 }}
            strokeWidth={2.5}
          />
          <h2 className="text-[13px] font-semibold text-gray-700">Overdue Orders</h2>
          {!loading && (
            <span className="ml-0.5 font-mono text-[11px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full tabular-nums leading-none">
              {overdue.length}
            </span>
          )}
        </div>

        {loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {['Order #', 'Product', 'Qty', 'Priority', 'Target Date', 'Days Overdue', 'Status'].map(h => (
                    <th key={h} className="py-2.5 px-4 first:pl-5 last:pr-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className={i < 2 ? 'border-b border-gray-100' : ''}>
                    <td className="py-3.5 pl-5 pr-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 110 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 56 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 56 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 96 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 40 }} /></td>
                    <td className="py-3.5 px-4 pr-5"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && overdue.length === 0 && (
          <div className="flex flex-col items-center justify-center h-36 gap-2">
            <CheckCircle className="w-6 h-6 text-green-400" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-400">All orders are on schedule.</p>
          </div>
        )}

        {!loading && overdue.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {([
                    ['Order #',      'text-left  pl-5 pr-4'],
                    ['Product',      'text-left  px-4'],
                    ['Qty',          'text-right px-4'],
                    ['Priority',     'text-left  px-4'],
                    ['Target Date',  'text-left  px-4'],
                    ['Days Overdue', 'text-right px-4'],
                    ['Status',       'text-left  px-4 pr-5'],
                  ] as [string, string][]).map(([label, cls]) => (
                    <th
                      key={label}
                      className={`py-2.5 ${cls} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {overdue.map((row, i) => (
                  <tr
                    key={row.id}
                    className={[
                      'bg-red-50/50 hover:bg-red-50 transition-colors',
                      i < overdue.length - 1 ? 'border-b border-red-100/80' : '',
                    ].join(' ')}
                  >
                    {/* Order # (links to detail page) */}
                    <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                      <Link
                        href={`/work-orders/${row.id}`}
                        className="font-mono text-[13px] font-medium text-primary hover:underline underline-offset-2"
                      >
                        {row.order_number}
                      </Link>
                    </td>

                    {/* Product */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap text-[13px]">
                      {row.products?.name ?? '—'}
                    </td>

                    {/* Qty */}
                    <td className="py-3.5 px-4 text-right font-mono text-[13px] text-gray-600 whitespace-nowrap tabular-nums">
                      {row.quantity}
                      {row.products?.unit && (
                        <span className="ml-1 text-[11px] text-gray-400">{row.products.unit}</span>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const p = PRIORITY_CFG[row.priority]
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold ${p?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p?.dot }} />
                            {p?.label ?? capitalize(row.priority)}
                          </span>
                        )
                      })()}
                    </td>

                    {/* Target Date */}
                    <td className="py-3.5 px-4 text-[13px] text-gray-600 whitespace-nowrap">
                      {fmtDate(row.scheduled_end)}
                    </td>

                    {/* Days Overdue */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-mono text-[13px] font-bold text-red-600 tabular-nums">
                        {row.days_overdue}d
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 pr-5">
                      {(() => {
                        const s = STATUS_CFG[row.status]
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold ${s?.cls ?? 'bg-gray-100 text-gray-500'}`}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s?.dot }} />
                            {s?.label ?? row.status}
                          </span>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── At-risk predictions ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <TrendingUp
            className="text-amber-500 shrink-0"
            style={{ width: 14, height: 14 }}
            strokeWidth={2.5}
          />
          <h2 className="text-[13px] font-semibold text-gray-700">At-Risk Orders</h2>
          {!loading && (
            <span className="ml-0.5 font-mono text-[11px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full tabular-nums leading-none">
              {atRisk.length}
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-300">
            Predicted to miss target based on avg transition times
          </span>
        </div>

        {loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {['Order #', 'Product', 'Status', 'Target Date', 'Predicted End', 'Days Late'].map(h => (
                    <th key={h} className="py-2.5 px-4 first:pl-5 last:pr-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className={i < 2 ? 'border-b border-gray-100' : ''}>
                    <td className="py-3.5 pl-5 pr-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 110 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 96 }} /></td>
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 96 }} /></td>
                    <td className="py-3.5 px-4 pr-5"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 40 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && atRisk.length === 0 && (
          <div className="flex flex-col items-center justify-center h-36 gap-2">
            <CheckCircle className="w-6 h-6 text-green-400" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-400">All active orders are predicted to finish on time.</p>
          </div>
        )}

        {!loading && atRisk.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {([
                    ['Order #',       'text-left  pl-5 pr-4'],
                    ['Product',       'text-left  px-4'],
                    ['Status',        'text-left  px-4'],
                    ['Target Date',   'text-left  px-4'],
                    ['Predicted End', 'text-left  px-4'],
                    ['Days Late',     'text-right px-4 pr-5'],
                  ] as [string, string][]).map(([label, cls]) => (
                    <th
                      key={label}
                      className={`py-2.5 ${cls} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atRisk.map((row, i) => (
                  <tr
                    key={row.id}
                    className={[
                      'bg-amber-50/40 hover:bg-amber-50 transition-colors',
                      i < atRisk.length - 1 ? 'border-b border-amber-100/60' : '',
                    ].join(' ')}
                  >
                    {/* Order # */}
                    <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                      <Link
                        href={`/work-orders/${row.id}`}
                        className="font-mono text-[13px] font-medium text-primary hover:underline underline-offset-2"
                      >
                        {row.order_number}
                      </Link>
                    </td>

                    {/* Product */}
                    <td className="py-3.5 px-4 text-gray-700 whitespace-nowrap text-[13px]">
                      {row.product}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const s = STATUS_CFG[row.status as WOStatus]
                        return s ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-semibold ${s.cls}`}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
                            {s.label}
                          </span>
                        ) : (
                          <span className="text-[13px] text-gray-500">{capitalize(row.status)}</span>
                        )
                      })()}
                    </td>

                    {/* Target Date */}
                    <td className="py-3.5 px-4 text-[13px] text-gray-600 whitespace-nowrap tabular-nums">
                      {fmtDate(row.target_date)}
                    </td>

                    {/* Predicted End */}
                    <td className="py-3.5 px-4 text-[13px] font-medium text-amber-700 whitespace-nowrap tabular-nums">
                      {fmtDate(row.predicted_end_date)}
                    </td>

                    {/* Days Late */}
                    <td className="py-3.5 px-4 pr-5 text-right whitespace-nowrap">
                      <span className="font-mono text-[13px] font-bold text-amber-600 tabular-nums">
                        +{row.days_at_risk}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-2.5 text-[11px] text-gray-300 border-t border-gray-100">
              Estimates use avg time-in-status across completed orders for the same product.
              Overdue orders are excluded (shown above).
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
