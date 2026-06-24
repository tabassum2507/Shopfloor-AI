import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  const { data, count, error } = await sb
    .from('inventory_transactions')
    .select(
      `id, type, quantity, notes, created_by, created_at,
       raw_materials ( id, name, sku, unit ),
       work_orders   ( id, order_number )`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit })
}
