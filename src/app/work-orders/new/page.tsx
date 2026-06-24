'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, CheckCircle2, AlertTriangle, FlaskConical } from 'lucide-react'
import { PRIORITY_CFG, type WOPriority } from '@/lib/wo-config'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

type ProductOption = { id: string; name: string; sku: string; unit: string }

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

type ProductDetail = {
  id: string
  name: string
  sku: string
  unit: string
  bom_items: BOMItem[]
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtQty(n: number | null | undefined, decimals = 4): string {
  if (n == null || isNaN(n)) return '—'
  return +n.toFixed(decimals) + ''
}

const INPUT = [
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors placeholder:text-gray-300',
].join(' ')

const PRIORITIES: WOPriority[] = ['low', 'medium', 'high', 'urgent']

// ─── Page ─────────────────────────────────────────────────────

export default function NewWorkOrderPage() {
  const router = useRouter()

  // Form state
  const [productId,    setProductId]    = useState('')
  const [quantity,     setQuantity]     = useState('')
  const [priority,     setPriority]     = useState<WOPriority>('medium')
  const [scheduledEnd, setScheduledEnd] = useState('')
  const [notes,        setNotes]        = useState('')
  const [saving,       setSaving]       = useState(false)

  // Data
  const [products,       setProducts]       = useState<ProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productDetail,  setProductDetail]  = useState<ProductDetail | null>(null)
  const [loadingBOM,     setLoadingBOM]     = useState(false)

  // ── Load product list ──────────────────────────────────────

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(d => setProducts(d ?? []))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoadingProducts(false))
  }, [])

  // ── Load BOM when product changes ─────────────────────────

  const fetchBOM = useCallback(async (id: string) => {
    if (!id) { setProductDetail(null); return }
    setLoadingBOM(true)
    try {
      const res = await fetch(`/api/products/${id}`)
      if (!res.ok) throw new Error()
      setProductDetail(await res.json())
    } catch {
      toast.error('Failed to load product BOM')
    } finally {
      setLoadingBOM(false)
    }
  }, [])

  useEffect(() => { fetchBOM(productId) }, [productId, fetchBOM])

  // ── Live BOM requirement calculation ──────────────────────

  const qty = parseFloat(quantity) || 0
  const selectedProduct = products.find(p => p.id === productId)

  const requirements = useMemo(() => {
    if (!productDetail?.bom_items) return []
    return productDetail.bom_items.map(item => {
      const stockQty   = item.raw_materials?.stock_quantity ?? 0
      const required   = qty > 0 ? (item.quantity ?? 0) * qty : null
      const sufficient = required !== null ? stockQty >= required : null
      return { ...item, required, sufficient }
    })
  }, [productDetail, qty])

  const canSubmit = productId && qty > 0 && priority && !saving

  // ── Submit ────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)

    try {
      const res  = await fetch('/api/work-orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id:    productId,
          quantity:      qty,
          priority,
          scheduled_end: scheduledEnd || null,
          notes:         notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create work order')

      toast.success(`${data.order_number} created`)
      router.push(`/work-orders/${data.id}`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-5">

      {/* Back nav */}
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Work Orders
      </Link>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Product + Quantity ── */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-[13px] font-semibold text-gray-700">Order Details</h2>

          {/* Product selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Product <span className="text-red-400">*</span>
            </label>
            {loadingProducts ? (
              <div className="flex items-center gap-2 py-2 text-[13px] text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading products…
              </div>
            ) : (
              <select
                required
                value={productId}
                onChange={e => setProductId(e.target.value)}
                className={INPUT + ' bg-white'}
              >
                <option value="">Select a product…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Quantity{selectedProduct ? ` (${selectedProduct.unit})` : ''} <span className="text-red-400">*</span>
            </label>
            <div className="flex">
              <input
                type="number"
                required
                min="0.001"
                step="0.001"
                placeholder="0"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className={[
                  'flex-1 px-3 py-2 border border-gray-200 rounded-l-lg text-[13px] font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'transition-colors placeholder:text-gray-300',
                ].join(' ')}
              />
              <span className="px-3 py-2 border border-l-0 border-gray-200 bg-gray-50 text-[12px] text-gray-500 rounded-r-lg flex items-center">
                {selectedProduct?.unit ?? 'units'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Materials preview (live) ── */}
        {productId && (
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
              <FlaskConical className="text-gray-400" style={{ width: 14, height: 14 }} />
              <h3 className="text-[13px] font-semibold text-gray-700">Materials Required</h3>
              {qty > 0 && (
                <span className="ml-auto text-[11px] text-gray-400">
                  for {fmtQty(qty)} {selectedProduct?.unit}
                </span>
              )}
            </div>

            {loadingBOM ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
              </div>
            ) : requirements.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-gray-400">
                No BOM items defined for this product.{' '}
                <Link href={`/products/${productId}`} className="text-primary hover:underline">
                  Add materials →
                </Link>
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/60 border-b border-gray-100">
                      {[
                        { l: 'Material',      c: 'text-left  pl-5 pr-4' },
                        { l: 'Per Unit Out',  c: 'text-right px-4' },
                        { l: 'Total Required',c: 'text-right px-4' },
                        { l: 'In Stock',      c: 'text-right px-4' },
                        { l: '',              c: 'px-4 pr-5 w-6' },
                      ].map(h => (
                        <th key={h.l} className={`py-2 ${h.c} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}>
                          {h.l}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((req, i) => (
                      <tr
                        key={req.id}
                        className={[
                          'transition-colors',
                          req.sufficient === false ? 'bg-red-50/40' : '',
                          i < requirements.length - 1 ? 'border-b border-gray-100' : '',
                        ].join(' ')}
                      >
                        {/* Material name */}
                        <td className="py-3 pl-5 pr-4 font-medium text-gray-800 whitespace-nowrap text-[13px]">
                          {req.raw_materials?.name ?? '—'}
                          <span className="ml-2 font-mono text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {req.raw_materials?.sku}
                          </span>
                        </td>

                        {/* Per unit */}
                        <td className="py-3 px-4 text-right font-mono text-[12.5px] text-gray-500 whitespace-nowrap tabular-nums">
                          {fmtQty(req.quantity)} {req.unit}
                        </td>

                        {/* Total required */}
                        <td className="py-3 px-4 text-right font-mono text-[13px] font-medium text-gray-700 whitespace-nowrap tabular-nums">
                          {req.required !== null
                            ? `${fmtQty(req.required)} ${req.unit}`
                            : <span className="text-gray-300 font-normal">—</span>
                          }
                        </td>

                        {/* Stock */}
                        <td className={`py-3 px-4 text-right font-mono text-[13px] whitespace-nowrap tabular-nums ${req.sufficient === false ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {fmtQty(req.raw_materials?.stock_quantity)} {req.raw_materials?.unit}
                        </td>

                        {/* Status icon */}
                        <td className="py-3 px-4 pr-5 text-center">
                          {req.sufficient === true && (
                            <CheckCircle2 className="text-green-500 mx-auto" style={{ width: 15, height: 15 }} />
                          )}
                          {req.sufficient === false && (
                            <AlertTriangle className="text-red-500 mx-auto" style={{ width: 15, height: 15 }} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Priority + Schedule + Notes ── */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-[13px] font-semibold text-gray-700">Scheduling</h2>

          {/* Priority selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Priority <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => {
                const cfg    = PRIORITY_CFG[p]
                const active = priority === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={[
                      'flex-1 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all',
                      active ? cfg.btn : 'border-gray-200 text-gray-400 hover:border-gray-300',
                    ].join(' ')}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Target date */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Target Date
            </label>
            <input
              type="date"
              value={scheduledEnd}
              onChange={e => setScheduledEnd(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className={INPUT}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Notes
            </label>
            <textarea
              rows={3}
              placeholder="Optional notes or instructions…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className={INPUT + ' resize-none'}
            />
          </div>
        </div>

        {/* ── Insufficient stock warning ── */}
        {requirements.some(r => r.sufficient === false) && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-[13px] text-red-700">
            <AlertTriangle className="shrink-0 mt-0.5 text-red-500" style={{ width: 15, height: 15 }} />
            <span>
              <strong>Insufficient stock</strong> for one or more materials. You can still create this
              order — stock availability will be checked again at completion.
            </span>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3">
          <Link
            href="/work-orders"
            className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Creating…' : 'Create Work Order'}
          </button>
        </div>
      </form>
    </div>
  )
}
