import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

// NOTE: products.category column requires this one-time migration if you've
// already run seed.sql:
//   ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Finished Goods';

export async function GET() {
  const { data, error } = await db()
    .from('products')
    .select('*, bom_items(id)')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { name, sku, category, unit, description } = body

  if (!name?.trim() || !sku?.trim() || !unit?.trim()) {
    return NextResponse.json(
      { error: 'name, sku, and unit are required' },
      { status: 400 }
    )
  }

  const { data, error } = await db()
    .from('products')
    .insert({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category: category ?? 'Finished Goods',
      unit,
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
