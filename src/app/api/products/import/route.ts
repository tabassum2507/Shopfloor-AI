import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

type Row = { name: string; sku: string; category: string; unit: string }

export async function POST(req: Request) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const rows: Row[] = Array.isArray(body.rows) ? body.rows : []

  if (rows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, errors: ['No rows provided'] })
  }

  // Fetch existing SKUs to detect duplicates server-side
  const { data: existing, error: fetchErr } = await sb
    .from('products')
    .select('sku')

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  const existingSkus = new Set((existing ?? []).map(r => r.sku.toUpperCase()))

  const toInsert: Row[] = []
  const errors:   string[] = []
  let   skipped = 0

  rows.forEach((row, idx) => {
    const lineNum = idx + 1

    const name = row.name?.trim()
    const sku  = row.sku?.trim().toUpperCase()
    const unit = row.unit?.trim()

    if (!name) { errors.push(`Row ${lineNum}: "name" is required`);  return }
    if (!sku)  { errors.push(`Row ${lineNum}: "sku" is required`);   return }
    if (!unit) { errors.push(`Row ${lineNum}: "unit" is required`);  return }

    if (existingSkus.has(sku)) {
      skipped++
      return
    }

    existingSkus.add(sku) // prevent intra-batch duplicates
    toInsert.push({
      name,
      sku,
      category: row.category?.trim() || 'Finished Goods',
      unit,
    })
  })

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, skipped, errors })
  }

  let { error: insertErr } = await sb.from('products').insert(toInsert)

  // If the category column doesn't exist yet (schema migration not run),
  // retry without it so the import still works with DB defaults.
  if (insertErr?.message?.includes('category')) {
    const withoutCategory = toInsert.map(({ category: _c, ...rest }) => rest)
    const { error: retryErr } = await sb.from('products').insert(withoutCategory)
    insertErr = retryErr ?? null
  }

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ imported: toInsert.length, skipped, errors })
}
