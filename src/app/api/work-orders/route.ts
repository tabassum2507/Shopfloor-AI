import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

export async function GET(req: Request) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')

  let q = sb
    .from('work_orders')
    .select(`
      id, order_number, quantity, status, priority,
      scheduled_start, scheduled_end, actual_start, actual_end,
      notes, created_at, updated_at,
      products ( id, name, sku, unit )
    `)
    .order('created_at', { ascending: false })

  if (status)   q = q.eq('status',   status)
  if (priority) q = q.eq('priority', priority)
  if (from)     q = q.gte('scheduled_end', from)
  if (to)       q = q.lte('scheduled_end', to + 'T23:59:59.999Z')

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { product_id, quantity, priority, scheduled_end, notes } = body

  if (!product_id || !quantity || Number(quantity) <= 0 || !priority) {
    return NextResponse.json(
      { error: 'product_id, quantity (> 0), and priority are required' },
      { status: 400 }
    )
  }

  // Trigger auto-generates order_number when the field is omitted
  const { data: wo, error: woErr } = await sb
    .from('work_orders')
    .insert({
      product_id,
      quantity:     parseFloat(quantity),
      priority,
      status:       'queued',
      scheduled_end: scheduled_end || null,
      notes:        notes?.trim() || null,
    })
    .select()
    .single()

  if (woErr) return NextResponse.json({ error: woErr.message }, { status: 400 })

  // Log initial queued status
  await sb.from('status_history').insert({
    work_order_id: wo.id,
    from_status:   null,
    to_status:     'queued',
    changed_by:    'system',
    notes:         'Work order created',
  })

  return NextResponse.json(wo, { status: 201 })
}
