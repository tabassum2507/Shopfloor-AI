'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Loader2, ChevronRight, Package } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { toast } from '@/components/ui/toast'
import CsvUploader from '@/components/CsvUploader'

// ─── Types ────────────────────────────────────────────────────

type ProductRow = {
  id: string
  name: string
  sku: string
  category: string | null
  unit: string
  description: string | null
  bom_items: { id: string }[]
}

type FormState = {
  name: string
  sku: string
  category: string
  unit: string
}

type FormErrors = { name?: string; sku?: string }

// ─── Constants ────────────────────────────────────────────────

const CATEGORIES = ['Finished Goods', 'Semi-Finished', 'Intermediate']
const UNITS      = ['tonnes', 'kg', 'pieces', 'meters']

const EMPTY_FORM: FormState = {
  name: '',
  sku: '',
  category: 'Finished Goods',
  unit: 'tonnes',
}

const INPUT = [
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm',
  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
  'transition-colors placeholder:text-gray-300',
].join(' ')

const INPUT_ERR = [
  'w-full px-3 py-2 border border-red-300 rounded-lg text-sm',
  'focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400',
  'transition-colors placeholder:text-gray-300',
].join(' ')

const SELECT = INPUT + ' bg-white'

// ─── Skeleton ─────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/60 border-b border-gray-100">
            {['Name', 'SKU', 'Category', 'Unit', 'Materials', 'Actions'].map(h => (
              <th key={h} className="py-2.5 px-4 first:pl-5 last:pr-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-left whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className={i < 4 ? 'border-b border-gray-100' : ''}>
              <td className="py-3.5 pl-5 pr-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 140 }} /></td>
              <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 60 }} /></td>
              <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 100 }} /></td>
              <td className="py-3.5 px-4"><div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: 50 }} /></td>
              <td className="py-3.5 px-4 text-center"><div className="h-3 bg-gray-100 rounded animate-pulse mx-auto" style={{ width: 20 }} /></td>
              <td className="py-3.5 px-4 pr-5"><div className="h-6 bg-gray-100 rounded animate-pulse ml-auto" style={{ width: 60 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]         = useState<ProductRow[]>([])
  const [loading, setLoading]           = useState(true)

  // Modal: null = closed, { mode, product? }
  const [modal, setModal]               = useState<{ mode: 'add' | 'edit'; product?: ProductRow } | null>(null)
  const [form, setForm]                 = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving]             = useState(false)
  const [errors, setErrors]             = useState<FormErrors>({})

  // Per-row delete confirmation
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [deleting, setDeleting]           = useState<string | null>(null)

  // ── Data loading ──────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Failed to load products')
      setProducts(await res.json())
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Modal helpers ─────────────────────────────────────────

  function openAdd() {
    setForm(EMPTY_FORM)
    setErrors({})
    setModal({ mode: 'add' })
  }

  function openEdit(p: ProductRow) {
    setForm({
      name:     p.name,
      sku:      p.sku,
      category: p.category ?? 'Finished Goods',
      unit:     p.unit,
    })
    setErrors({})
    setModal({ mode: 'edit', product: p })
  }

  function closeModal() {
    setModal(null)
    setForm(EMPTY_FORM)
    setErrors({})
  }

  function patchForm(patch: Partial<FormState>) {
    setForm(prev => ({ ...prev, ...patch }))
  }

  // ── CRUD ──────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const newErrors: FormErrors = {}
    if (!form.name.trim()) newErrors.name = 'Product name is required'
    if (!form.sku.trim())  newErrors.sku  = 'SKU is required'
    if (Object.keys(newErrors).length) { setErrors(newErrors); return }
    setErrors({})

    setSaving(true)

    const isEdit = modal?.mode === 'edit'
    const url    = isEdit ? `/api/products/${modal!.product!.id}` : '/api/products'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res  = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')

      toast.success(isEdit ? 'Product updated' : 'Product created')
      closeModal()
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res  = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')

      toast.success('Product deleted')
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
      setPendingDelete(null)
    }
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Page actions bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] text-gray-500">
          {loading ? '' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex items-center gap-2">
          <CsvUploader
            title="Import Products"
            endpoint="/api/products/import"
            columns={[
              { key: 'name',     label: 'Product Name', required: true  },
              { key: 'sku',      label: 'SKU',          required: true  },
              { key: 'category', label: 'Category',     required: false },
              { key: 'unit',     label: 'Unit',         required: true  },
            ]}
            templateFilename="products-template.csv"
            templateContent={
              'name,sku,category,unit\r\n' +
              'TMT Bar 20mm,TMT-20,Finished Goods,tonnes\r\n' +
              'Channel 100x50,CH-100,Finished Goods,tonnes\r\n'
            }
            onSuccess={load}
          />
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-2 rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus style={{ width: 15, height: 15 }} />
            Add Product
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

        {/* Loading skeleton */}
        {loading && <SkeletonTable />}

        {/* Empty */}
        {!loading && products.length === 0 && (
          <div className="flex flex-col items-center justify-center h-52 gap-2">
            <Package className="w-8 h-8 text-gray-200" strokeWidth={1.5} />
            <p className="text-[13px] text-gray-400">No products yet</p>
            <button
              onClick={openAdd}
              className="text-[12px] text-primary hover:underline font-medium"
            >
              Add your first product →
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  {[
                    { label: 'Name',      cls: 'text-left pl-5 pr-4' },
                    { label: 'SKU',       cls: 'text-left px-4' },
                    { label: 'Category',  cls: 'text-left px-4' },
                    { label: 'Unit',      cls: 'text-left px-4' },
                    { label: 'Materials', cls: 'text-center px-4' },
                    { label: 'Actions',   cls: 'text-center px-4 pr-5' },
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
                {products.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50/60 transition-colors ${i < products.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    {/* Name → detail link */}
                    <td className="py-3.5 pl-5 pr-4 whitespace-nowrap">
                      <Link
                        href={`/products/${p.id}`}
                        className="flex items-center gap-1 font-medium text-gray-800 hover:text-primary transition-colors group"
                      >
                        {p.name}
                        <ChevronRight
                          className="text-gray-300 group-hover:text-primary transition-colors"
                          style={{ width: 13, height: 13 }}
                        />
                      </Link>
                    </td>

                    {/* SKU */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono text-[12px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {p.sku}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4 text-[13px] text-gray-600 whitespace-nowrap">
                      {p.category ?? <span className="text-gray-300">—</span>}
                    </td>

                    {/* Unit */}
                    <td className="py-3.5 px-4 text-[13px] text-gray-600">
                      {p.unit}
                    </td>

                    {/* BOM item count */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-[13px] font-medium text-gray-700 tabular-nums">
                        {p.bom_items.length}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 pr-5">
                      {pendingDelete === p.id ? (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-[12px] text-gray-500">Delete?</span>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
                            className="text-[12px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {deleting === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                          </button>
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="text-[12px] text-gray-400 hover:text-gray-600"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            title="Edit"
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <Pencil style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            onClick={() => setPendingDelete(p.id)}
                            title="Delete"
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

      {/* ── Add / Edit Product Modal ── */}
      <Modal
        isOpen={modal !== null}
        onClose={closeModal}
        title={modal?.mode === 'edit' ? 'Edit Product' : 'Add Product'}
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. TMT Bar 20mm"
              value={form.name}
              onChange={e => {
                patchForm({ name: e.target.value })
                if (errors.name) setErrors(p => ({ ...p, name: undefined }))
              }}
              className={errors.name ? INPUT_ERR : INPUT}
            />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>

          {/* SKU */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
              SKU <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. TMT-20"
              value={form.sku}
              onChange={e => {
                patchForm({ sku: e.target.value.toUpperCase() })
                if (errors.sku) setErrors(p => ({ ...p, sku: undefined }))
              }}
              className={(errors.sku ? INPUT_ERR : INPUT) + ' font-mono'}
            />
            {errors.sku && <p className="mt-1 text-[11px] text-red-500">{errors.sku}</p>}
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Category
              </label>
              <select
                value={form.category}
                onChange={e => patchForm({ category: e.target.value })}
                className={SELECT}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Unit <span className="text-red-400">*</span>
              </label>
              <select
                value={form.unit}
                onChange={e => patchForm({ unit: e.target.value })}
                className={SELECT}
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-[13px] text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving…' : modal?.mode === 'edit' ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
