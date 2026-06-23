import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

type Ctx = { params: { id: string } }

export async function POST(req: Request, { params }: Ctx) {
  const body = await req.json().catch(() => ({}))
  const { raw_material_id, quantity, unit } = body

  if (!raw_material_id || !quantity || Number(quantity) <= 0) {
    return NextResponse.json(
      { error: 'raw_material_id and a positive quantity are required' },
      { status: 400 }
    )
  }

  // Prevent duplicate material in the same product's BOM
  const { data: existing } = await db()
    .from('bom_items')
    .select('id')
    .eq('product_id', params.id)
    .eq('raw_material_id', raw_material_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'This material is already in the BOM. Edit the existing entry instead.' },
      { status: 409 }
    )
  }

  const { data, error } = await db()
    .from('bom_items')
    .insert({
      product_id: params.id,
      raw_material_id,
      quantity: parseFloat(quantity),
      unit,
    })
    .select('*, raw_materials ( id, name, sku, unit )')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
