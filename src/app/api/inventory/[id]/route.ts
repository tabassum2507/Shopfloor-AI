import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

type Ctx = { params: { id: string } }

export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json().catch(() => ({}))
  const { quantity, notes } = body

  const qty = parseFloat(quantity)
  if (!qty || qty <= 0) {
    return NextResponse.json({ error: 'quantity must be greater than 0' }, { status: 400 })
  }

  const sb = db()

  // Fetch current stock
  const { data: rm, error: fetchErr } = await sb
    .from('raw_materials')
    .select('id, name, unit, stock_quantity')
    .eq('id', params.id)
    .single()

  if (fetchErr) return NextResponse.json({ error: 'Material not found' }, { status: 404 })

  // Update stock_quantity
  const { data, error } = await sb
    .from('raw_materials')
    .update({ stock_quantity: rm.stock_quantity + qty })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Log restock transaction
  await sb.from('inventory_transactions').insert({
    raw_material_id: params.id,
    type:            'restock',
    quantity:        qty,
    notes:           notes?.trim() || null,
    created_by:      'user',
  })

  return NextResponse.json(data)
}
