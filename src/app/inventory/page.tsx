'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, RefreshCcw, Package2, AlertTriangle, Plus,
} from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'
import CsvUploader from '@/components/CsvUploader'

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

// ─── Stock status ─────────────────────────────────────────────

type StockStatus = 'ok' | 'low' | 'critical'

function getStatus(stock: number, reorder: number): StockStatus {
  if (stock <= 0)              return 'critical'
  if (reorder <= 0)            return 'ok'
  if (stock > reorder)         return 'ok'
  if (stock > reorder * 0.5)   return 'low'
  return 'critical'
}

// ─── Shared style constants ───────────────────────────────────

const INPUT = [
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors placeholder:text-gray-300',
].join(' ')

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

// ─── Helpers ──────────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 4 })
}

function fmtQty(n: number): string {
  return +n.toFixed(4) + ''
}

// ─── Page ─────────────────────────────────────────────────────

export default function InventoryPage() {
  const [materials,      setMaterials]      = useState<RawMaterial[]>([])
  const [loadingStock,   setLoadingStock]   = useState(true)
  const [restockTarget,  setRestockTarget]  = useState<RawMaterial | null>(null)
  const [restockQty,     setRestockQty]     = useState('')
  const [restockNotes,   setRestockNotes]   = useState('')
  const [saving,         setSaving]         = useState(false)

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

  useEffect(() => { loadMaterials() }, [loadMaterials])

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

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[15px] font-semibold text-gray-800">Stock Levels</h1>
          {!loadingStock && (
            <p className="text-[12px] text-gray-400 mt-0.5">
              {materials.length} material{materials.length !== 1 ? 's' : ''}
              {lowCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {lowCount} low</span>}
              {criticalCount > 0 && <span className="ml-2 text-red-600 font-medium">· {criticalCount} critical</span>}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <CsvUploader
            title="Import Raw Materials"
            endpoint="/api/inventory/import"
            columns={[
              { key: 'name',          label: 'Material Name',  required: true  },
              { key: 'unit',          label: 'Unit',           required: true  },
              { key: 'current_stock', label: 'Current Stock',  required: false },
              { key: 'reorder_level', label: 'Reorder Level',  required: false },
            ]}
            templateFilename="inventory-template.csv"
            templateContent={
              'name,unit,current_stock,reorder_level\r\n' +
              'Copper Wire,kg,500,50\r\n' +
              'Lubricant Oil,litres,200,30\r\n'
            }
            onSuccess={loadMaterials}
          />
          <button
            onClick={loadMaterials}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCcw style={{ width: 12, height: 12 }} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stock table ── */}
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
                      className={[rowBg, i < materials.length - 1 ? 'border-b border-gray-100' : '', 'transition-colors'].join(' ')}
                    >
                      <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                        <p className="text-[13px] font-semibold text-gray-800">{m.name}</p>
                        {m.description && (
                          <p className="text-[11px] text-gray-400 mt-0.5 max-w-[200px] truncate">{m.description}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11.5px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {m.sku}
                        </span>
                      </td>
                      <td className={`py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums text-[13px] font-semibold ${
                        status === 'critical' ? 'text-red-600' :
                        status === 'low'      ? 'text-amber-600' :
                        'text-gray-700'
                      }`}>
                        {fmtNum(m.stock_quantity)}
                        <span className="ml-1 text-[11px] font-normal text-gray-400">{m.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono tabular-nums text-[12.5px] text-gray-500">
                        {fmtNum(m.reorder_point)}
                        <span className="ml-1 text-[11px] text-gray-400">{m.unit}</span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StockBadge status={status} />
                      </td>
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

      {/* ── Restock Modal ── */}
      <Modal
        isOpen={!!restockTarget}
        onClose={() => setRestockTarget(null)}
        title={`Restock ${restockTarget?.name ?? ''}`}
        size="sm"
      >
        {restockTarget && (
          <form onSubmit={handleRestock} className="space-y-4">
            <div className="flex gap-6 p-3 bg-gray-50 rounded-lg text-[13px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Current Stock</p>
                <p className={`font-mono font-bold tabular-nums ${
                  getStatus(restockTarget.stock_quantity, restockTarget.reorder_point) === 'critical' ? 'text-red-600' :
                  getStatus(restockTarget.stock_quantity, restockTarget.reorder_point) === 'low'      ? 'text-amber-600' :
                  'text-gray-700'
                }`}>
                  {fmtNum(restockTarget.stock_quantity)} {restockTarget.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Reorder Level</p>
                <p className="font-mono text-gray-500 tabular-nums">
                  {fmtNum(restockTarget.reorder_point)} {restockTarget.unit}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Quantity to Add ({restockTarget.unit}) <span className="text-red-400">*</span>
              </label>
              <input
                type="number" required min="0.001" step="0.001" placeholder="0"
                value={restockQty} onChange={e => setRestockQty(e.target.value)}
                autoFocus className={INPUT + ' font-mono'}
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

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Notes</label>
              <textarea
                rows={2} placeholder="Supplier, batch number, PO reference…"
                value={restockNotes} onChange={e => setRestockNotes(e.target.value)}
                className={INPUT + ' resize-none'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setRestockTarget(null)}
                className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={!restockQty || parseFloat(restockQty) <= 0 || saving}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
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
