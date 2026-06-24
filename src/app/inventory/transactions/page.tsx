'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftRight, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────

function fmtQty(n: number): string {
  return +n.toFixed(4) + ''
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// ─── Sub-components ───────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function TransactionLogPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading,      setLoading]      = useState(true)
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/transactions?page=${page}&limit=${PAGE_SIZE}`)
      if (!res.ok) throw new Error()
      const { data, total: t } = await res.json()
      setTransactions(data)
      setTotal(t)
    } catch {
      toast.error('Failed to load transaction log')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Transaction Log</h1>
          {!loading && (
            <p className="text-[12px] text-gray-400 mt-0.5">
              {total} transaction{total !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCcw style={{ width: 12, height: 12 }} />
          Refresh
        </button>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

        {/* Loading skeleton */}
        {loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {['Date / Time', 'Material', 'Type', 'Quantity', 'Work Order', 'Notes'].map(h => (
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
                    <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 80 }} /></td>
                    <td className="py-3.5 px-4 pr-5"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 100 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty state */}
        {!loading && transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <ArrowLeftRight className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
            <div className="text-center">
              <p className="text-[13px] text-gray-400">No transactions yet.</p>
              <p className="text-[12px] text-gray-300 mt-0.5">
                Entries appear here when work orders are completed or materials are restocked.
              </p>
            </div>
          </div>
        )}

        {/* Data table */}
        {!loading && transactions.length > 0 && (
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
                      { l: 'Work Order',   c: 'text-left px-4' },
                      { l: 'Notes',        c: 'text-left px-4 pr-5' },
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
                      {/* Date */}
                      <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                        <span className="font-mono text-[12px] text-gray-500 tabular-nums">
                          {fmtDateTime(tx.created_at)}
                        </span>
                      </td>

                      {/* Material */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {tx.raw_materials ? (
                          <div>
                            <p className="text-[13px] font-medium text-gray-800">{tx.raw_materials.name}</p>
                            <p className="font-mono text-[11px] text-gray-400 mt-0.5">{tx.raw_materials.sku}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <TxTypeBadge type={tx.type} />
                      </td>

                      {/* Quantity */}
                      <td className={`py-3.5 px-4 text-right font-mono tabular-nums text-[13px] font-semibold whitespace-nowrap ${
                        tx.type === 'consumption' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {tx.type === 'consumption' ? '−' : '+'}{fmtQty(tx.quantity)}
                        {tx.raw_materials && (
                          <span className="ml-1 text-[11px] font-normal text-gray-400">{tx.raw_materials.unit}</span>
                        )}
                      </td>

                      {/* Work Order */}
                      <td className="py-3.5 px-4">
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

                      {/* Notes */}
                      <td className="py-3.5 px-4 pr-5 max-w-[200px]">
                        {tx.notes ? (
                          <span className="text-[12px] text-gray-500 truncate block">{tx.notes}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <p className="text-[12px] text-gray-400">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1 text-[12.5px] text-gray-600 hover:text-primary disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                  Prev
                </button>
                <span className="font-mono text-[12px] text-gray-500 tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages}
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
    </div>
  )
}
