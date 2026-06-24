import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

type Ctx = { params: { id: string; itemId: string } }

export async function DELETE(_req: Request, { params }: Ctx) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await sb
    .from('bom_items')
    .delete()
    .eq('id', params.itemId)
    .eq('product_id', params.id) // ensure item belongs to this product

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
