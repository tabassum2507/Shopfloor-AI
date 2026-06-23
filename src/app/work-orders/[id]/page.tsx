'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Clock, Zap, ShieldCheck,
  CheckCircle2, XCircle, FlaskConical, CalendarDays,
} from 'lucide-react'
import {
  STATUS_CFG, PRIORITY_CFG, VALID_TRANSITIONS, TRANSITION_LABELS,
  type WOStatus, type WOPriority,
} from '@/lib/wo-config'
import { toast } from '@/components/ui/toast'
import Modal from '@/components/ui/Modal'

// ─── Types ────────────────────────────────────────────────────

type StatusHistoryEntry = {
  id: string
  from_status: WOStatus | null
  to_status: WOStatus
  changed_by: string | null
  notes: string | null
  created_at: string
}

type BOMItem = {
  id: string
  quantity: number
  unit: string
  raw_materials: {
    id: string
    name: string
    sku: string
    unit: string
    stock_quantity: number
  }
}

type WODetail = {
  id: string
  order_number: string
  quantity: number
  status: WOStatus
  priority: WOPriority
  scheduled_start: string | null
  scheduled_end: string | null
  actual_start: string | null
  actual_end: string | null
  notes: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  products: {
    id: string
    name: string
    sku: string
    unit: string
    bom_items: BOMItem[]
  } | null
  status_history: StatusHistoryEntry[]
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fmtDateTime(d: string): string {
  const dt = new Date(d)
  return dt.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function fmtQty(n: number): string {
  return +n.toFixed(4) + ''
}

function isOverdue(wo: WODetail): boolean {
  if (!wo.scheduled_end) return false
  if (wo.status === 'done' || wo.status === 'cancelled') return false
  return new Date(wo.scheduled_end) < new Date()
}

// ─── Sub-components ───────────────────────────────────────────

function StatusIcon({ status }: { status: WOStatus }) {
  const s = { width: 13, height: 13 }
  switch (status) {
    case 'queued':      return <Clock       style={s} />
    case 'in_progress': return <Zap         style={s} />
    case 'qc':          return <ShieldCheck style={s} />
    case 'done':        return <CheckCircle2 style={s} />
    case 'cancelled':   return <XCircle     style={s} />
  }
}

function MetaPill({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <span className={`text-[13px] font-medium ${red ? 'text-red-500' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [wo,          setWo]          = useState<WODetail | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [transitioning, setTransitioning] = useState<WOStatus | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [stockError,    setStockError]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/work-orders/${params.id}`)
      if (!res.ok) throw new Error()
      setWo(await res.json())
    } catch {
      toast.error('Failed to load work order')
      router.push('/work-orders')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => { load() }, [load])

  // ── Status transition ─────────────────────────────────────

  async function transition(toStatus: WOStatus) {
    if (!wo) return
    setTransitioning(toStatus)
    try {
      const res = await fetch(`/api/work-orders/${wo.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_status: toStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Transition failed')
      toast.success(`Status updated to ${STATUS_CFG[toStatus].label}`)
      setCancelConfirm(false)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      if (msg.toLowerCase().startsWith('insufficient stock')) {
        setStockError(msg)
      } else {
        toast.error(msg)
      }
    } finally {
      setTransitioning(null)
    }
  }

  // ── Render states ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-52">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (!wo) return null

  const validNext = VALID_TRANSITIONS[wo.status] ?? []
  const statusCfg = STATUS_CFG[wo.status]
  const priCfg    = PRIORITY_CFG[wo.priority]
  const overdue   = isOverdue(wo)
  const bomItems  = wo.products?.bom_items ?? []

  return (
    <div className="space-y-5">

      {/* ── Breadcrumb ── */}
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Work Orders
      </Link>

      {/* ── Header card ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 space-y-4">

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-2xl font-bold text-primary tracking-tight">
              {wo.order_number}
            </p>
            <p className="text-[14px] text-gray-600 mt-0.5 font-medium">
              {wo.products?.name ?? '—'}
              <span className="ml-2 font-mono text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {wo.products?.sku}
              </span>
            </p>
          </div>

          {/* Status + Priority badges */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${statusCfg.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusCfg.dot }} />
              {statusCfg.label}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${priCfg.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priCfg.dot }} />
              {priCfg.label}
            </span>
          </div>
        </div>

        {/* Meta pills */}
        <div className="flex flex-wrap gap-x-8 gap-y-3 pt-1 border-t border-gray-100">
          <MetaPill
            label="Quantity"
            value={`${fmtQty(wo.quantity)} ${wo.products?.unit ?? ''}`}
          />
          <MetaPill
            label="Target Date"
            value={fmtDate(wo.scheduled_end)}
            red={overdue}
          />
          {wo.scheduled_end && overdue && (
            <MetaPill label="Status" value="Overdue" red />
          )}
          <MetaPill label="Started"   value={fmtDate(wo.actual_start)} />
          <MetaPill label="Completed" value={fmtDate(wo.actual_end)} />
          <MetaPill label="Created"   value={fmtDate(wo.created_at)} />
        </div>

        {/* Notes */}
        {wo.notes && (
          <p className="text-[13px] text-gray-500 bg-gray-50 rounded px-3 py-2 border border-gray-100">
            {wo.notes}
          </p>
        )}

        {/* ── Status change buttons ── */}
        {validNext.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
              Actions
            </p>

            {cancelConfirm ? (
              <div className="flex items-center gap-3 text-[13px]">
                <span className="text-red-600 font-medium">Cancel this work order?</span>
                <button
                  onClick={() => transition('cancelled')}
                  disabled={transitioning === 'cancelled'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-[12.5px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  {transitioning === 'cancelled' && <Loader2 className="w-3 h-3 animate-spin" />}
                  Yes, cancel
                </button>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {validNext.filter(s => s !== 'cancelled').map(nextStatus => (
                  <button
                    key={nextStatus}
                    onClick={() => transition(nextStatus)}
                    disabled={!!transitioning}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {transitioning === nextStatus
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <StatusIcon status={nextStatus} />
                    }
                    {TRANSITION_LABELS[nextStatus]}
                  </button>
                ))}

                {validNext.includes('cancelled') && (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="px-4 py-2 border border-red-200 text-red-500 rounded-lg text-[13px] font-medium hover:bg-red-50 transition-colors"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Two-column lower section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">

        {/* ── Status Timeline ── */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Status Timeline
          </p>

          {wo.status_history.length === 0 ? (
            <p className="text-[13px] text-gray-400">No history recorded.</p>
          ) : (
            <div>
              {wo.status_history.map((entry, i) => {
                const cfg    = STATUS_CFG[entry.to_status]
                const isLast = i === wo.status_history.length - 1

                return (
                  <div key={entry.id} className="flex gap-3">
                    {/* Dot + line */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
                        style={{ borderColor: cfg.dot, backgroundColor: cfg.dot + '18' }}
                      >
                        <span style={{ color: cfg.dot }}>
                          <StatusIcon status={entry.to_status} />
                        </span>
                      </div>
                      {!isLast && (
                        <div className="w-0.5 bg-gray-200 my-1" style={{ minHeight: 20, flex: 1 }} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`${isLast ? '' : 'pb-4'} pt-0.5`}>
                      <p className="text-[13px] font-semibold" style={{ color: cfg.dot }}>
                        {cfg.label}
                      </p>
                      {entry.from_status && (
                        <p className="text-[11px] text-gray-400">
                          from {STATUS_CFG[entry.from_status].label}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {fmtDateTime(entry.created_at)}
                        {entry.changed_by && (
                          <span className="ml-1">· {entry.changed_by}</span>
                        )}
                      </p>
                      {entry.notes && (
                        <p className="text-[12px] text-gray-500 mt-1 italic">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── BOM Requirements ── */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <FlaskConical className="text-gray-400" style={{ width: 14, height: 14 }} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Materials for this Order
            </p>
            <span className="ml-auto font-mono text-[11px] text-gray-400">
              {fmtQty(wo.quantity)} {wo.products?.unit ?? ''}
            </span>
          </div>

          {bomItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 gap-1.5">
              <FlaskConical className="w-6 h-6 text-gray-200" strokeWidth={1.5} />
              <p className="text-[13px] text-gray-400">No BOM defined for this product.</p>
              {wo.products?.id && (
                <Link href={`/products/${wo.products.id}`} className="text-[12px] text-primary hover:underline">
                  Add materials →
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[
                      { l: 'Material',       c: 'text-left  pl-5 pr-4' },
                      { l: 'Per Unit',       c: 'text-right px-4' },
                      { l: 'Total Required', c: 'text-right px-4' },
                      { l: 'Current Stock',  c: 'text-right px-4 pr-5' },
                    ].map(h => (
                      <th key={h.l} className={`py-2.5 ${h.c} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}>
                        {h.l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bomItems.map((item, i) => {
                    const required   = item.quantity * wo.quantity
                    const sufficient = item.raw_materials.stock_quantity >= required

                    return (
                      <tr
                        key={item.id}
                        className={[
                          'transition-colors',
                          wo.status !== 'done' && wo.status !== 'cancelled' && !sufficient
                            ? 'bg-red-50/40' : '',
                          i < bomItems.length - 1 ? 'border-b border-gray-100' : '',
                        ].join(' ')}
                      >
                        {/* Material name */}
                        <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                          <p className="text-[13px] font-medium text-gray-800">
                            {item.raw_materials.name}
                          </p>
                          <p className="font-mono text-[11px] text-gray-400 mt-0.5">
                            {item.raw_materials.sku}
                          </p>
                        </td>

                        {/* Per unit */}
                        <td className="py-3.5 px-4 text-right font-mono text-[12.5px] text-gray-500 whitespace-nowrap tabular-nums">
                          {fmtQty(item.quantity)} {item.unit}
                        </td>

                        {/* Required */}
                        <td className="py-3.5 px-4 text-right font-mono text-[13px] font-medium text-gray-700 whitespace-nowrap tabular-nums">
                          {fmtQty(required)} {item.unit}
                        </td>

                        {/* Stock */}
                        <td className={`py-3.5 px-4 pr-5 text-right font-mono text-[13px] whitespace-nowrap tabular-nums ${
                          wo.status !== 'done' && wo.status !== 'cancelled' && !sufficient
                            ? 'text-red-600 font-medium'
                            : 'text-gray-600'
                        }`}>
                          <span className="flex items-center justify-end gap-1.5">
                            {wo.status !== 'done' && wo.status !== 'cancelled' && (
                              sufficient
                                ? <CheckCircle2 className="text-green-500 shrink-0" style={{ width: 13, height: 13 }} />
                                : <XCircle      className="text-red-400 shrink-0"   style={{ width: 13, height: 13 }} />
                            )}
                            {fmtQty(item.raw_materials.stock_quantity)} {item.raw_materials.unit}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer note for done orders */}
          {wo.status === 'done' && bomItems.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-100 bg-green-50/50">
              <CalendarDays className="text-green-600 shrink-0" style={{ width: 12, height: 12 }} />
              <p className="text-[11px] text-green-700">
                Materials were deducted from stock when this order was completed on {fmtDate(wo.actual_end)}.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Insufficient Stock Modal ── */}
      <Modal
        isOpen={!!stockError}
        onClose={() => setStockError(null)}
        title="Insufficient Stock"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <XCircle className="text-red-500 shrink-0 mt-0.5" style={{ width: 15, height: 15 }} />
            <p className="text-[13px] text-red-700 leading-relaxed">{stockError}</p>
          </div>

          {bomItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Shortfalls
              </p>
              {bomItems
                .filter(item => item.raw_materials.stock_quantity < item.quantity * wo.quantity)
                .map(item => {
                  const required = item.quantity * wo.quantity
                  const shortage = required - item.raw_materials.stock_quantity
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-[12.5px] px-3 py-2 bg-red-50/60 rounded-lg border border-red-100"
                    >
                      <span className="text-gray-800 font-medium">{item.raw_materials.name}</span>
                      <span className="font-mono text-red-600 font-semibold">
                        −{fmtQty(shortage)} {item.unit} short
                      </span>
                    </div>
                  )
                })
              }
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <Link href="/inventory" className="text-[12px] text-primary hover:underline">
              Go to Inventory →
            </Link>
            <button
              onClick={() => setStockError(null)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-[13px] hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
