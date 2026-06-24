import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { VALID_TRANSITIONS, type WOStatus } from '@/lib/wo-config'

type Ctx = { params: { id: string } }

// ─── GET /api/work-orders/[id] ────────────────────────────────

export async function GET(_req: Request, { params }: Ctx) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await sb
    .from('work_orders')
    .select(`
      *,
      products (
        id, name, sku, unit,
        bom_items (
          id, quantity, unit,
          raw_materials ( id, name, sku, unit, stock_quantity )
        )
      ),
      status_history (
        id, from_status, to_status, changed_by, notes, created_at
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  // Sort status_history chronologically (Supabase doesn't order nested tables)
  if (Array.isArray(data.status_history)) {
    data.status_history.sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  return NextResponse.json(data)
}

// ─── PATCH /api/work-orders/[id] ─────────────────────────────

export async function PATCH(req: Request, { params }: Ctx) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { to_status, notes }: { to_status: WOStatus; notes?: string } = body

  // 1. Fetch current work order with BOM for inventory deduction
  const { data: wo, error: fetchErr } = await sb
    .from('work_orders')
    .select(`
      id, status, quantity, order_number, actual_start, actual_end,
      products (
        bom_items (
          quantity,
          raw_materials ( id, name, unit, stock_quantity )
        )
      )
    `)
    .eq('id', params.id)
    .single()

  if (fetchErr) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

  // 2. Validate transition
  const allowed = VALID_TRANSITIONS[wo.status as WOStatus] ?? []
  if (!allowed.includes(to_status)) {
    return NextResponse.json(
      { error: `Cannot transition from "${wo.status}" to "${to_status}"` },
      { status: 422 }
    )
  }

  // 3. Build update payload
  const update: Record<string, unknown> = { status: to_status }

  if (to_status === 'in_progress' && !wo.actual_start) {
    update.actual_start = new Date().toISOString()
  }
  if (to_status === 'done') {
    update.actual_end = new Date().toISOString()
  }

  // 4. Inventory deduction when work order is completed
  if (to_status === 'done') {
    const bomItems: Array<{
      quantity: number
      raw_materials: { id: string; name: string; unit: string; stock_quantity: number }
    }> = (wo as any).products?.bom_items ?? []

    // Pre-flight: verify ALL materials have enough stock before touching anything.
    for (const item of bomItems) {
      const need = item.quantity * wo.quantity
      const rm   = item.raw_materials
      if (rm.stock_quantity < need) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${rm.name}: need ${need} ${rm.unit}, have ${rm.stock_quantity} ${rm.unit}`,
          },
          { status: 422 }
        )
      }
    }

    // All checks passed — deduct from every material and log transactions.
    for (const item of bomItems) {
      const requiredQty = item.quantity * wo.quantity
      const rm          = item.raw_materials

      await sb.from('inventory_transactions').insert({
        raw_material_id: rm.id,
        work_order_id:   wo.id,
        type:            'consumption',
        quantity:        requiredQty,
        notes:           `Completion of ${wo.order_number}`,
        created_by:      'system',
      })

      await sb
        .from('raw_materials')
        .update({ stock_quantity: rm.stock_quantity - requiredQty })
        .eq('id', rm.id)
    }
  }

  // 5. Update work order status
  const { data, error } = await sb
    .from('work_orders')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 6. Log status change
  await sb.from('status_history').insert({
    work_order_id: params.id,
    from_status:   wo.status,
    to_status,
    changed_by:    'user',
    notes:         notes?.trim() || null,
  })

  return NextResponse.json(data)
}
