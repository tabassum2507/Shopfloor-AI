'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2, FlaskConical, Tag, Ruler } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'

// ─── Types ────────────────────────────────────────────────────

type RawMaterial = {
  id: string
  name: string
  sku: string
  unit: string
  stock_quantity: number
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
  }
}

type Product = {
  id: string
  name: string
  sku: string
  category: string | null
  unit: string
  description: string | null
  bom_items: BOMItem[]
}

// ─── Helpers ──────────────────────────────────────────────────

function fmtQty(n: number): string {
  // 1.0800 → "1.08", 0.0050 → "0.005", 1.0000 → "1"
  return +n.toFixed(4) + ''
}

const INPUT = [
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors placeholder:text-gray-300',
].join(' ')

// ─── Page ─────────────────────────────────────────────────────

export default function ProductDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params

  const [product, setProduct]         = useState<Product | null>(null)
  const [loading, setLoading]         = useState(true)
  const [notFound, setNotFound]       = useState(false)

  // BOM add modal
  const [bomModalOpen, setBomModalOpen]     = useState(false)
  const [rawMaterials, setRawMaterials]     = useState<RawMaterial[]>([])
  const [loadingRM, setLoadingRM]           = useState(false)
  const [selectedRM, setSelectedRM]         = useState('')
  const [qty, setQty]                       = useState('')
  const [savingBOM, setSavingBOM]           = useState(false)

  // Per-row BOM delete
  const [pendingBOMDelete, setPendingBOMDelete] = useState<string | null>(null)
  const [deletingBOM, setDeletingBOM]           = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────

  const loadProduct = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/products/${id}`)
      if (res.status === 404) { setNotFound(true); return }
      if (!res.ok) throw new Error('Failed to load product')
      setProduct(await res.json())
    } catch {
      toast.error('Failed to load product')
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadRawMaterials = useCallback(async () => {
    if (rawMaterials.length > 0) return // already loaded
    setLoadingRM(true)
    try {
      const res = await fetch('/api/raw-materials')
      if (!res.ok) throw new Error()
      setRawMaterials(await res.json())
    } catch {
      toast.error('Failed to load raw materials')
    } finally {
      setLoadingRM(false)
    }
  }, [rawMaterials.length])

  useEffect(() => { loadProduct() }, [loadProduct])

  function openBOMModal() {
    setSelectedRM('')
    setQty('')
    setBomModalOpen(true)
    loadRawMaterials()
  }

  // ── Already-added material IDs (prevent re-adding) ────────

  const addedMaterialIds = new Set(
    product?.bom_items.map(b => b.raw_materials.id) ?? []
  )

  const availableRM = rawMaterials.filter(m => !addedMaterialIds.has(m.id))
  const currentRM   = rawMaterials.find(m => m.id === selectedRM)

  // ── BOM: add item ─────────────────────────────────────────

  async function handleAddBOM(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRM || !qty || Number(qty) <= 0) {
      toast.error('Select a material and enter a positive quantity')
      return
    }

    setSavingBOM(true)
    try {
      const res  = await fetch(`/api/products/${id}/bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_material_id: selectedRM,
          quantity: qty,
          unit: currentRM?.unit ?? 'tonnes',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add material')

      toast.success('Material added to BOM')
      setBomModalOpen(false)
      loadProduct()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add material')
    } finally {
      setSavingBOM(false)
    }
  }

  // ── BOM: delete item ──────────────────────────────────────

  async function handleDeleteBOM(itemId: string) {
    setDeletingBOM(itemId)
    try {
      const res  = await fetch(`/api/products/${id}/bom/${itemId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to remove material')

      toast.success('Material removed from BOM')
      setProduct(prev =>
        prev ? { ...prev, bom_items: prev.bom_items.filter(b => b.id !== itemId) } : prev
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove material')
    } finally {
      setDeletingBOM(null)
      setPendingBOMDelete(null)
    }
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Product not found.</p>
        <Link href="/products" className="text-sm text-primary hover:underline">← Back to Products</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Back nav ── */}
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-primary transition-colors"
      >
        <ArrowLeft style={{ width: 14, height: 14 }} />
        Products
      </Link>

      {/* ── Product info card ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-gray-800 leading-tight">
              {product.name}
            </h2>
            {product.description && (
              <p className="text-[13px] text-gray-500 mt-1">{product.description}</p>
            )}
          </div>
          <span className="font-mono text-[13px] text-gray-600 bg-gray-100 px-2.5 py-1 rounded shrink-0">
            {product.sku}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 mt-5">
          <InfoPill icon={<Tag style={{ width: 13, height: 13 }} />} label="Category">
            {product.category ?? '—'}
          </InfoPill>
          <InfoPill icon={<Ruler style={{ width: 13, height: 13 }} />} label="Unit">
            {product.unit}
          </InfoPill>
          <InfoPill icon={<FlaskConical style={{ width: 13, height: 13 }} />} label="BOM items">
            <span className="font-mono tabular-nums">{product.bom_items.length}</span>
          </InfoPill>
        </div>
      </div>

      {/* ── Bill of Materials ── */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold text-gray-700">Bill of Materials</h3>
          <button
            onClick={openBOMModal}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus style={{ width: 13, height: 13 }} />
            Add Material
          </button>
        </div>

        {/* BOM table */}
        {product.bom_items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 gap-2">
            <FlaskConical className="w-7 h-7 text-gray-200" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-400">No materials in BOM yet</p>
            <button
              onClick={openBOMModal}
              className="text-[12px] text-primary hover:underline font-medium"
            >
              Add first material →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[
                    { label: 'Material Name', cls: 'text-left pl-5 pr-4' },
                    { label: 'SKU',           cls: 'text-left px-4' },
                    { label: 'Qty / Unit',    cls: 'text-right px-4' },
                    { label: 'Unit',          cls: 'text-left px-4' },
                    { label: 'Actions',       cls: 'text-center px-4 pr-5' },
                  ].map(h => (
                    <th
                      key={h.label}
                      className={`py-2.5 ${h.cls} text-[11px] font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {product.bom_items.map((item, i) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50/60 transition-colors ${i < product.bom_items.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    {/* Material name */}
                    <td className="py-3.5 pl-5 pr-4 font-medium text-gray-800 whitespace-nowrap">
                      {item.raw_materials.name}
                    </td>

                    {/* SKU */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-[12px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.raw_materials.sku}
                      </span>
                    </td>

                    {/* Qty */}
                    <td className="py-3.5 px-4 text-right font-mono text-[13px] text-gray-700 tabular-nums whitespace-nowrap">
                      {fmtQty(item.quantity)}
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 text-[13px] text-gray-500 whitespace-nowrap">
                      {item.unit}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 pr-5">
                      {pendingBOMDelete === item.id ? (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-[12px] text-gray-500">Remove?</span>
                          <button
                            onClick={() => handleDeleteBOM(item.id)}
                            disabled={deletingBOM === item.id}
                            className="text-[12px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingBOM === item.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : 'Yes'}
                          </button>
                          <button
                            onClick={() => setPendingBOMDelete(null)}
                            className="text-[12px] text-gray-400 hover:text-gray-600"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <button
                            onClick={() => setPendingBOMDelete(item.id)}
                            title="Remove from BOM"
                            className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 style={{ width: 13, height: 13 }} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add BOM Item Modal ── */}
      <Modal
        isOpen={bomModalOpen}
        onClose={() => setBomModalOpen(false)}
        title="Add Material to BOM"
        size="sm"
      >
        <form onSubmit={handleAddBOM} className="space-y-4">

          {/* Raw material dropdown */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Raw Material <span className="text-red-400">*</span>
            </label>
            {loadingRM ? (
              <div className="flex items-center gap-2 py-2 text-[13px] text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading materials…
              </div>
            ) : availableRM.length === 0 && !loadingRM ? (
              <p className="text-[13px] text-gray-400 py-2">
                {rawMaterials.length === 0
                  ? 'No raw materials found. Add some in the Inventory module.'
                  : 'All materials are already in this BOM.'}
              </p>
            ) : (
              <select
                required
                value={selectedRM}
                onChange={e => setSelectedRM(e.target.value)}
                className={INPUT + ' bg-white'}
              >
                <option value="">Select a raw material…</option>
                {availableRM.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.sku})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity + auto unit */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Quantity per {product.unit} of output <span className="text-red-400">*</span>
            </label>
            <div className="flex">
              <input
                type="number"
                required
                min="0.0001"
                step="0.0001"
                placeholder="0.0000"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className={[
                  'flex-1 px-3 py-2 border border-gray-200 rounded-l-lg text-sm font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'transition-colors placeholder:text-gray-300',
                ].join(' ')}
              />
              <span className="px-3 py-2 border border-l-0 border-gray-200 bg-gray-50 text-[12px] text-gray-500 rounded-r-lg flex items-center whitespace-nowrap">
                {currentRM?.unit ?? '—'}
              </span>
            </div>
            {currentRM && (
              <p className="text-[11px] text-gray-400 mt-1.5">
                Stock: <span className="font-mono">{currentRM.stock_quantity}</span> {currentRM.unit}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setBomModalOpen(false)}
              className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingBOM || !selectedRM || !qty}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {savingBOM && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {savingBOM ? 'Adding…' : 'Add Material'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Small info pill used in the product header ───────────────

function InfoPill({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-[13px] text-gray-700 font-medium">{children}</span>
    </div>
  )
}
