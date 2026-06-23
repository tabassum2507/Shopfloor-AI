'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Loader2, RefreshCcw, Package2, AlertTriangle,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

type RawMaterial = {
  id: string
  name: string
  sku: string
  unit: string
  stock_quantity: number
  reorder_point: number
  description: string | null
}

type Transaction = {
  id: string
  type: 'consumption' | 'restock'
  quantity: number
  notes: string | null
  created_by: string | null
  created_at: string
  raw_materials: { id: string; name: string; sku: string; unit: string } | null
  work_orders: { id: string; order_number: string } | null
}

// ─── Stock status ─────────────────────────────────────────────

type StockStatus = 'ok' | 'low' | 'critical'

function getStatus(stock: number, reorder: number): StockStatus {
  if (stock <= 0)          return 'critical'
  if (reorder <= 0)        return 'ok'
  if (stock > reorder)     return 'ok'
  if (stock > reorder * 0.5) return 'low'
  return 'critical'
}

// ─── Shared style constants ───────────────────────────────────

const INPUT = [
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors placeholder:text-gray-300',
].join(' ')

const PAGE_SIZE = 20

type Tab = 'stock' | 'transactions'

// ─── Sub-components ───────────────────────────────────────────

function StockBadge({ status }: { status: StockStatus }) {
  if (status === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded bg-red-100 text-red-700 text-[11px] font-semibold">
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        Critical
      </span>
    )
  }
  if (status === 'low') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded bg-amber-100 text-amber-700 text-[11px] font-semibold">
        <AlertTriangle style={{ width: 10, height: 10 }} />
        Low Stock
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded bg-green-100 text-green-700 text-[11px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
      OK
    </span>
  )
}

function TxTypeBadge({ type }: { type: Transaction['type'] }) {
  const isConsumption = type === 'consumption'
  return (
    <span className={[
      'inline-flex items-center px-2 py-[3px] rounded text-[11px] font-semibold',
      isConsumption ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
    ].join(' ')}>
      {isConsumption ? 'Consumption' : 'Restock'}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtQty(n: number): string {
  return +n.toFixed(4) + ''
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 4 })
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ─── Page ─────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>('stock')

  // Stock levels
  const [materials,     setMaterials]     = useState<RawMaterial[]>([])
  const [loadingStock,  setLoadingStock]  = useState(true)

  // Transaction log
  const [transactions,  setTransactions]  = useState<Transaction[]>([])
  const [loadingTx,     setLoadingTx]     = useState(false)
  const [totalTx,       setTotalTx]       = useState(0)
  const [txPage,        setTxPage]        = useState(1)

  // Restock modal
  const [restockTarget, setRestockTarget] = useState<RawMaterial | null>(null)
  const [restockQty,    setRestockQty]    = useState('')
  const [restockNotes,  setRestockNotes]  = useState('')
  const [saving,        setSaving]        = useState(false)

  // ── Data loading ──────────────────────────────────────────

  const loadMaterials = useCallback(async () => {
    setLoadingStock(true)
    try {
      const res = await fetch('/api/inventory')
      if (!res.ok) throw new Error()
      setMaterials(await res.json())
    } catch {
      toast.error('Failed to load stock levels')
    } finally {
      setLoadingStock(false)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    setLoadingTx(true)
    try {
      const res = await fetch(`/api/inventory/transactions?page=${txPage}&limit=${PAGE_SIZE}`)
      if (!res.ok) throw new Error()
      const { data, total } = await res.json()
      setTransactions(data)
      setTotalTx(total)
    } catch {
      toast.error('Failed to load transaction log')
    } finally {
      setLoadingTx(false)
    }
  }, [txPage])

  useEffect(() => { loadMaterials() }, [loadMaterials])

  useEffect(() => {
    if (tab === 'transactions') loadTransactions()
  }, [tab, txPage, loadTransactions])

  // ── Restock submit ────────────────────────────────────────

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(restockQty)
    if (!restockTarget || !qty || qty <= 0) return
    setSaving(true)

    try {
      const res = await fetch(`/api/inventory/${restockTarget.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, notes: restockNotes.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Restock failed')

      toast.success(`Added ${fmtQty(qty)} ${restockTarget.unit} of ${restockTarget.name}`)
      setRestockTarget(null)
      setRestockQty('')
      setRestockNotes('')
      await loadMaterials()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  function openRestock(m: RawMaterial) {
    setRestockTarget(m)
    setRestockQty('')
    setRestockNotes('')
  }

  // ── Derived ───────────────────────────────────────────────

  const lowCount      = materials.filter(m => getStatus(m.stock_quantity, m.reorder_point) === 'low').length
  const criticalCount = materials.filter(m => getStatus(m.stock_quantity, m.reorder_point) === 'critical').length
  const totalPages    = Math.max(1, Math.ceil(totalTx / PAGE_SIZE))

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Tab bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {([
            { key: 'stock',        label: 'Stock Levels' },
            { key: 'transactions', label: 'Transaction Log' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                'relative px-4 py-1.5 rounded-md text-[13px] font-medium transition-all',
                tab === t.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-800',
              ].join(' ')}
            >
              {t.label}
              {/* Critical count badge on Stock tab */}
              {t.key === 'stock' && criticalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 text-white text-[9px] font-bold rounded-full">
                  {criticalCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'stock' && (
          <div className="flex items-center gap-4">
            {/* Summary stats */}
            {!loadingStock && (
              <p className="text-[13px] text-gray-500">
                {materials.length} material{materials.length !== 1 ? 's' : ''}
                {lowCount > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">· {lowCount} low</span>
                )}
                {criticalCount > 0 && (
                  <span className="ml-2 text-red-600 font-medium">· {criticalCount} critical</span>
                )}
              </p>
            )}
            <button
              onClick={loadMaterials}
              className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCcw style={{ width: 12, height: 12 }} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          STOCK LEVELS TAB
          ══════════════════════════════════════════════════════ */}
      {tab === 'stock' && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          {loadingStock && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {['Material', 'SKU', 'Current Stock', 'Reorder Level', 'Status', ''].map(h => (
                      <th key={h} className="py-2.5 px-4 first:pl-5 last:pr-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className={i < 5 ? 'border-b border-gray-100' : ''}>
                      <td className="py-3.5 pl-5 pr-4">
                        <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 130 }} />
                        <div className="h-2.5 bg-gray-100 rounded animate-pulse mt-1.5" style={{ width: 80 }} />
                      </td>
                      <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 64 }} /></td>
                      <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 80 }} /></td>
                      <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 80 }} /></td>
                      <td className="py-3.5 px-4"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 64 }} /></td>
                      <td className="py-3.5 px-4 pr-5"><div className="h-7 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 80 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingStock && materials.length === 0 && (
            <div className="flex flex-col items-center justify-center h-52 gap-2">
              <Package2 className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
              <p className="text-[13px] text-gray-400">No raw materials defined yet.</p>
            </div>
          )}

          {!loadingStock && materials.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {[
                      { l: 'Material',      c: 'text-left  pl-5 pr-4' },
                      { l: 'SKU',           c: 'text-left  px-4' },
                      { l: 'Current Stock', c: 'text-right px-4' },
                      { l: 'Reorder Level', c: 'text-right px-4' },
                      { l: 'Status',        c: 'text-left  px-4' },
                      { l: '',              c: 'px-4 pr-5 text-right' },
                    ].map(h => (
                      <th
                        key={h.l}
                        className={`py-2.5 ${h.c} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}
                      >
                        {h.l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, i) => {
                    const status = getStatus(m.stock_quantity, m.reorder_point)
                    const rowBg =
                      status === 'critical' ? 'bg-red-50/40' :
                      status === 'low'      ? 'bg-amber-50/30' : ''

                    return (
                      <tr
                        key={m.id}
                        className={[
                          rowBg,
                          i < materials.length - 1 ? 'border-b border-gray-100' : '',
                          'transition-colors',
                        ].join(' ')}
                      >
                        {/* Material */}
                        <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                          <p className="text-[13px] font-semibold text-gray-800">{m.name}</p>
                          {m.description && (
                            <p className="text-[11px] text-gray-400 mt-0.5 max-w-[200px] truncate">
                              {m.description}
                            </p>
                          )}
                        </td>

                        {/* SKU */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono text-[11.5px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {m.sku}
                          </span>
                        </td>

                        {/* Current stock */}
                        <td className={`py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums text-[13px] font-semibold ${
                          status === 'critical' ? 'text-red-600' :
                          status === 'low'      ? 'text-amber-600' :
                          'text-gray-700'
                        }`}>
                          {fmtNum(m.stock_quantity)}
                          <span className="ml-1 text-[11px] font-normal text-gray-400">{m.unit}</span>
                        </td>

                        {/* Reorder level */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums text-[12.5px] text-gray-500">
                          {fmtNum(m.reorder_point)}
                          <span className="ml-1 text-[11px] text-gray-400">{m.unit}</span>
                        </td>

                        {/* Status badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <StockBadge status={status} />
                        </td>

                        {/* Restock button */}
                        <td className="py-3.5 px-4 pr-5 text-right">
                          <button
                            onClick={() => openRestock(m)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary/30 text-primary rounded-lg text-[12px] font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
                          >
                            <Plus style={{ width: 12, height: 12 }} />
                            Restock
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TRANSACTION LOG TAB
          ══════════════════════════════════════════════════════ */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          {loadingTx && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    {['Date / Time', 'Material', 'Type', 'Quantity', 'Work Order'].map(h => (
                      <th key={h} className="py-2.5 px-4 first:pl-5 last:pr-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className={i < 7 ? 'border-b border-gray-100' : ''}>
                      <td className="py-3.5 pl-5 pr-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 128 }} /></td>
                      <td className="py-3.5 px-4">
                        <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 110 }} />
                        <div className="h-2.5 bg-gray-100 rounded animate-pulse mt-1.5" style={{ width: 64 }} />
                      </td>
                      <td className="py-3.5 px-4"><div className="h-5 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                      <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 64 }} /></td>
                      <td className="py-3.5 px-4 pr-5"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingTx && transactions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-52 gap-2">
              <Package2 className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
              <p className="text-[13px] text-gray-400">
                No transactions yet. They appear here when work orders are completed or materials are restocked.
              </p>
            </div>
          )}

          {!loadingTx && transactions.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {[
                        { l: 'Date / Time',  c: 'text-left pl-5 pr-4' },
                        { l: 'Material',     c: 'text-left px-4' },
                        { l: 'Type',         c: 'text-left px-4' },
                        { l: 'Quantity',     c: 'text-right px-4' },
                        { l: 'Work Order',   c: 'text-left px-4 pr-5' },
                      ].map(h => (
                        <th
                          key={h.l}
                          className={`py-2.5 ${h.c} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}
                        >
                          {h.l}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {transactions.map((tx, i) => (
                      <tr
                        key={tx.id}
                        className={[
                          'transition-colors hover:bg-gray-50/40',
                          i < transactions.length - 1 ? 'border-b border-gray-100' : '',
                        ].join(' ')}
                      >
                        {/* Date / time */}
                        <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                          <span className="font-mono text-[12px] text-gray-500 tabular-nums">
                            {fmtDateTime(tx.created_at)}
                          </span>
                        </td>

                        {/* Material */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {tx.raw_materials ? (
                            <div>
                              <p className="text-[13px] font-medium text-gray-800">
                                {tx.raw_materials.name}
                              </p>
                              <p className="font-mono text-[11px] text-gray-400 mt-0.5">
                                {tx.raw_materials.sku}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Type badge */}
                        <td className="py-3.5 px-4">
                          <TxTypeBadge type={tx.type} />
                        </td>

                        {/* Quantity */}
                        <td className={`py-3.5 px-4 text-right font-mono tabular-nums text-[13px] font-semibold whitespace-nowrap ${
                          tx.type === 'consumption' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {tx.type === 'consumption' ? '−' : '+'}{fmtQty(tx.quantity)}
                          {tx.raw_materials && (
                            <span className="ml-1 text-[11px] font-normal text-gray-400">
                              {tx.raw_materials.unit}
                            </span>
                          )}
                        </td>

                        {/* Work order / manual */}
                        <td className="py-3.5 px-4 pr-5">
                          {tx.work_orders ? (
                            <Link
                              href={`/work-orders/${tx.work_orders.id}`}
                              className="font-mono text-[12.5px] font-semibold text-primary hover:underline underline-offset-2"
                            >
                              {tx.work_orders.order_number}
                            </Link>
                          ) : (
                            <span className="text-[12.5px] text-gray-400">Manual</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-[12px] text-gray-400">
                  {totalTx} transaction{totalTx !== 1 ? 's' : ''} total
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setTxPage(p => p - 1)}
                    disabled={txPage === 1}
                    className="flex items-center gap-1 text-[12.5px] text-gray-600 hover:text-primary disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft style={{ width: 14, height: 14 }} />
                    Prev
                  </button>
                  <span className="font-mono text-[12px] text-gray-500 tabular-nums">
                    {txPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setTxPage(p => p + 1)}
                    disabled={txPage >= totalPages}
                    className="flex items-center gap-1 text-[12.5px] text-gray-600 hover:text-primary disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          RESTOCK MODAL
          ══════════════════════════════════════════════════════ */}
      <Modal
        isOpen={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        title={`Restock ${restockTarget?.name ?? ''}`}
        size="sm"
      >
        {restockTarget && (
          <form onSubmit={handleRestock} className="space-y-4">
            {/* Current stock info */}
            <div className="flex gap-6 p-3 bg-gray-50 rounded-lg text-[13px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Current Stock
                </p>
                <p className={`font-mono font-bold tabular-nums ${
                  getStatus(restockTarget.stock_quantity, restockTarget.reorder_point) === 'critical'
                    ? 'text-red-600'
                    : getStatus(restockTarget.stock_quantity, restockTarget.reorder_point) === 'low'
                    ? 'text-amber-600'
                    : 'text-gray-700'
                }`}>
                  {fmtNum(restockTarget.stock_quantity)} {restockTarget.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                  Reorder Level
                </p>
                <p className="font-mono text-gray-500 tabular-nums">
                  {fmtNum(restockTarget.reorder_point)} {restockTarget.unit}
                </p>
              </div>
            </div>

            {/* Quantity input */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Quantity to Add ({restockTarget.unit}) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min="0.001"
                step="0.001"
                placeholder="0"
                value={restockQty}
                onChange={e => setRestockQty(e.target.value)}
                autoFocus
                className={INPUT + ' font-mono'}
              />
              {restockQty && parseFloat(restockQty) > 0 && (
                <p className="mt-1 text-[11px] text-gray-500">
                  New stock will be{' '}
                  <span className="font-mono font-semibold text-green-600">
                    {fmtNum(restockTarget.stock_quantity + parseFloat(restockQty))} {restockTarget.unit}
                  </span>
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Notes
              </label>
              <textarea
                rows={2}
                placeholder="Supplier, batch number, PO reference…"
                value={restockNotes}
                onChange={e => setRestockNotes(e.target.value)}
                className={INPUT + ' resize-none'}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!restockQty || parseFloat(restockQty) <= 0 || saving}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving…' : 'Confirm Restock'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
