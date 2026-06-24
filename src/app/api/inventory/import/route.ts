import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

type Row = {
  name:          string
  unit:          string
  current_stock: string
  reorder_level: string
}

function slugSku(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
}

export async function POST(req: Request) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rows: Row[] = Array.isArray(body.rows) ? body.rows : []

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, errors: ['No rows provided'] })
  }

  // Fetch existing material names to detect duplicates
  const { data: existing, error: fetchErr } = await sb
    .from('raw_materials')
    .select('name')

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const existingNames = new Set(
    (existing ?? []).map(r => r.name.trim().toLowerCase())
  )

  const toInsert: object[] = []
  const errors:   string[] = []
  let   skipped = 0

  rows.forEach((row, idx) => {
    const lineNum = idx + 1

    const name = row.name?.trim()
    const unit = row.unit?.trim()

    if (!name) { errors.push(`Row ${lineNum}: "name" is required`); return }
    if (!unit) { errors.push(`Row ${lineNum}: "unit" is required`); return }

    if (existingNames.has(name.toLowerCase())) {
      skipped++
      return
    }

    const stockRaw  = parseFloat(row.current_stock ?? '0')
    const reorderRaw = parseFloat(row.reorder_level ?? '0')

    if (row.current_stock && isNaN(stockRaw)) {
      errors.push(`Row ${lineNum}: "current_stock" must be a number`)
      return
    }
    if (row.reorder_level && isNaN(reorderRaw)) {
      errors.push(`Row ${lineNum}: "reorder_level" must be a number`)
      return
    }

    existingNames.add(name.toLowerCase()) // prevent intra-batch duplicates
    toInsert.push({
      name,
      sku:            slugSku(name),
      unit,
      stock_quantity: isNaN(stockRaw)  ? 0 : stockRaw,
      reorder_point:  isNaN(reorderRaw) ? 0 : reorderRaw,
    })
  })

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors })
  }

  const { error: insertErr } = await sb
    .from('raw_materials')
    .insert(toInsert)

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ imported: toInsert.length, skipped, errors })
}
