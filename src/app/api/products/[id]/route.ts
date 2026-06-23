import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

type Ctx = { params: { id: string } }

export async function GET(_req: Request, { params }: Ctx) {
  const { data, error } = await db()
    .from('products')
    .select(`
      *,
      bom_items (
        id,
        quantity,
        unit,
        raw_materials ( id, name, sku, unit )
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: Ctx) {
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
    .update({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category,
      unit,
      description: description?.trim() || null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { error } = await db()
    .from('products')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
