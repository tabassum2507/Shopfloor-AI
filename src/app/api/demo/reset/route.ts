import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'

export const runtime = 'nodejs'

function ago(days: number, hour = 6): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function fwd(days: number, hour = 18): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export async function POST() {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Clear in FK-safe order (Supabase requires a filter; not('id','is',null) matches all rows)
    const { error: e1 } = await sb.from('inventory_transactions').delete().not('id', 'is', null)
    if (e1) throw new Error(`Delete inventory_transactions: ${e1.message}`)

    const { error: e2 } = await sb.from('status_history').delete().not('id', 'is', null)
    if (e2) throw new Error(`Delete status_history: ${e2.message}`)

    const { error: e3 } = await sb.from('work_orders').delete().not('id', 'is', null)
    if (e3) throw new Error(`Delete work_orders: ${e3.message}`)

    const { error: e4 } = await sb.from('bom_items').delete().not('id', 'is', null)
    if (e4) throw new Error(`Delete bom_items: ${e4.message}`)

    const { error: e5 } = await sb.from('raw_materials').delete().not('id', 'is', null)
    if (e5) throw new Error(`Delete raw_materials: ${e5.message}`)

    const { error: e6 } = await sb.from('products').delete().not('id', 'is', null)
    if (e6) throw new Error(`Delete products: ${e6.message}`)

    // ── Products ──────────────────────────────────────────────
    const productRows = [
      { id: 'a0000001-0000-0000-0000-000000000001', name: 'TMT Bar 12mm',     sku: 'TMT-12',  category: 'Finished Goods', unit: 'tonnes' },
      { id: 'a0000001-0000-0000-0000-000000000002', name: 'TMT Bar 16mm',     sku: 'TMT-16',  category: 'Finished Goods', unit: 'tonnes' },
      { id: 'a0000001-0000-0000-0000-000000000003', name: 'Wire Rod 6mm',     sku: 'WR-06',   category: 'Intermediate',   unit: 'tonnes' },
      { id: 'a0000001-0000-0000-0000-000000000004', name: 'Angle Iron 50x50', sku: 'ANG-50',  category: 'Finished Goods', unit: 'tonnes' },
    ]
    let { error: pe } = await sb.from('products').insert(productRows)
    // Fallback: if category column missing (migration not applied yet), retry without it
    if (pe?.message?.includes('category')) {
      const rows = productRows.map(({ category: _c, ...rest }) => rest)
      const { error: pe2 } = await sb.from('products').insert(rows)
      pe = pe2 ?? null
    }
    if (pe) throw new Error(`Insert products: ${pe.message}`)

    // ── Raw Materials ─────────────────────────────────────────
    const { error: rme } = await sb.from('raw_materials').insert([
      { id: 'b0000002-0000-0000-0000-000000000001', name: 'Steel Billet',    sku: 'RM-BILLET', unit: 'tonnes', stock_quantity: 1200, reorder_point: 200 },
      { id: 'b0000002-0000-0000-0000-000000000002', name: 'Iron Ore',        sku: 'RM-IRORE',  unit: 'tonnes', stock_quantity: 3000, reorder_point: 500 },
      { id: 'b0000002-0000-0000-0000-000000000003', name: 'Ferro Manganese', sku: 'RM-FEMN',   unit: 'tonnes', stock_quantity:   80, reorder_point:  15 },
      { id: 'b0000002-0000-0000-0000-000000000004', name: 'Zinc',            sku: 'RM-ZINC',   unit: 'tonnes', stock_quantity:   25, reorder_point:   5 },
    ])
    if (rme) throw new Error(`Insert raw_materials: ${rme.message}`)

    // ── BOM Items ─────────────────────────────────────────────
    const { error: be } = await sb.from('bom_items').insert([
      { id: 'c0000003-0000-0000-0000-000000000001', product_id: 'a0000001-0000-0000-0000-000000000001', raw_material_id: 'b0000002-0000-0000-0000-000000000001', quantity: 1.0800, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000002', product_id: 'a0000001-0000-0000-0000-000000000001', raw_material_id: 'b0000002-0000-0000-0000-000000000003', quantity: 0.0150, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000003', product_id: 'a0000001-0000-0000-0000-000000000002', raw_material_id: 'b0000002-0000-0000-0000-000000000001', quantity: 1.1000, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000004', product_id: 'a0000001-0000-0000-0000-000000000002', raw_material_id: 'b0000002-0000-0000-0000-000000000003', quantity: 0.0180, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000005', product_id: 'a0000001-0000-0000-0000-000000000003', raw_material_id: 'b0000002-0000-0000-0000-000000000001', quantity: 1.0500, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000006', product_id: 'a0000001-0000-0000-0000-000000000003', raw_material_id: 'b0000002-0000-0000-0000-000000000003', quantity: 0.0100, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000007', product_id: 'a0000001-0000-0000-0000-000000000004', raw_material_id: 'b0000002-0000-0000-0000-000000000001', quantity: 1.1200, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000008', product_id: 'a0000001-0000-0000-0000-000000000004', raw_material_id: 'b0000002-0000-0000-0000-000000000003', quantity: 0.0200, unit: 'tonnes' },
      { id: 'c0000003-0000-0000-0000-000000000009', product_id: 'a0000001-0000-0000-0000-000000000004', raw_material_id: 'b0000002-0000-0000-0000-000000000004', quantity: 0.0050, unit: 'tonnes' },
    ])
    if (be) throw new Error(`Insert bom_items: ${be.message}`)

    // ── Work Orders (relative dates so demo stays current) ────
    const { error: we } = await sb.from('work_orders').insert([
      {
        id: 'd0000004-0000-0000-0000-000000000001', order_number: 'WO-2026-0035',
        product_id: 'a0000001-0000-0000-0000-000000000001',
        quantity: 50, status: 'done', priority: 'medium',
        scheduled_start: ago(22), scheduled_end: ago(20),
        actual_start: ago(22), actual_end: ago(20, 17),
        assigned_to: 'Ramesh Kumar', notes: 'Delivered to warehouse B2',
      },
      {
        id: 'd0000004-0000-0000-0000-000000000002', order_number: 'WO-2026-0036',
        product_id: 'a0000001-0000-0000-0000-000000000003',
        quantity: 30, status: 'done', priority: 'low',
        scheduled_start: ago(18), scheduled_end: ago(16),
        actual_start: ago(18, 7), actual_end: ago(16, 15),
        assigned_to: 'Suresh Patel', notes: 'Export batch — quality cert attached',
      },
      {
        id: 'd0000004-0000-0000-0000-000000000003', order_number: 'WO-2026-0037',
        product_id: 'a0000001-0000-0000-0000-000000000002',
        quantity: 75, status: 'in_progress', priority: 'high',
        scheduled_start: ago(13), scheduled_end: ago(9, 18),
        actual_start: ago(13), actual_end: null,
        assigned_to: 'Arjun Singh', notes: 'Delayed due to billet shortage — expedite',
      },
      {
        id: 'd0000004-0000-0000-0000-000000000004', order_number: 'WO-2026-0038',
        product_id: 'a0000001-0000-0000-0000-000000000004',
        quantity: 20, status: 'in_progress', priority: 'medium',
        scheduled_start: ago(11), scheduled_end: ago(8, 18),
        actual_start: ago(11, 8), actual_end: null,
        assigned_to: 'Vikram Nair', notes: null,
      },
      {
        id: 'd0000004-0000-0000-0000-000000000005', order_number: 'WO-2026-0039',
        product_id: 'a0000001-0000-0000-0000-000000000001',
        quantity: 100, status: 'qc', priority: 'high',
        scheduled_start: ago(15), scheduled_end: ago(11, 18),
        actual_start: ago(15), actual_end: null,
        assigned_to: 'Ramesh Kumar', notes: 'Awaiting QC lab results — sample batch held',
      },
      {
        id: 'd0000004-0000-0000-0000-000000000006', order_number: 'WO-2026-0040',
        product_id: 'a0000001-0000-0000-0000-000000000002',
        quantity: 60, status: 'queued', priority: 'medium',
        scheduled_start: fwd(2), scheduled_end: fwd(5),
        actual_start: null, actual_end: null,
        assigned_to: null, notes: null,
      },
      {
        id: 'd0000004-0000-0000-0000-000000000007', order_number: 'WO-2026-0041',
        product_id: 'a0000001-0000-0000-0000-000000000003',
        quantity: 45, status: 'queued', priority: 'low',
        scheduled_start: fwd(4), scheduled_end: fwd(7),
        actual_start: null, actual_end: null,
        assigned_to: null, notes: null,
      },
      {
        id: 'd0000004-0000-0000-0000-000000000008', order_number: 'WO-2026-0042',
        product_id: 'a0000001-0000-0000-0000-000000000004',
        quantity: 15, status: 'queued', priority: 'urgent',
        scheduled_start: fwd(1, 6), scheduled_end: fwd(1, 18),
        actual_start: null, actual_end: null,
        assigned_to: null, notes: 'Rush order — customer escalation',
      },
    ])
    if (we) throw new Error(`Insert work_orders: ${we.message}`)

    // ── Status History ────────────────────────────────────────
    const { error: she } = await sb.from('status_history').insert([
      // WO-0035: queued → in_progress → qc → done
      { id: 'e0000005-0000-0000-0000-000000000001', work_order_id: 'd0000004-0000-0000-0000-000000000001', from_status: null,          to_status: 'queued',      changed_by: 'system',       created_at: ago(24) },
      { id: 'e0000005-0000-0000-0000-000000000002', work_order_id: 'd0000004-0000-0000-0000-000000000001', from_status: 'queued',      to_status: 'in_progress', changed_by: 'Ramesh Kumar', created_at: ago(22) },
      { id: 'e0000005-0000-0000-0000-000000000003', work_order_id: 'd0000004-0000-0000-0000-000000000001', from_status: 'in_progress', to_status: 'qc',          changed_by: 'Ramesh Kumar', created_at: ago(20, 14) },
      { id: 'e0000005-0000-0000-0000-000000000004', work_order_id: 'd0000004-0000-0000-0000-000000000001', from_status: 'qc',          to_status: 'done',        changed_by: 'QC Team',      created_at: ago(20, 17) },
      // WO-0036: queued → in_progress → qc → done
      { id: 'e0000005-0000-0000-0000-000000000005', work_order_id: 'd0000004-0000-0000-0000-000000000002', from_status: null,          to_status: 'queued',      changed_by: 'system',       created_at: ago(20) },
      { id: 'e0000005-0000-0000-0000-000000000006', work_order_id: 'd0000004-0000-0000-0000-000000000002', from_status: 'queued',      to_status: 'in_progress', changed_by: 'Suresh Patel', created_at: ago(18, 7) },
      { id: 'e0000005-0000-0000-0000-000000000007', work_order_id: 'd0000004-0000-0000-0000-000000000002', from_status: 'in_progress', to_status: 'qc',          changed_by: 'Suresh Patel', created_at: ago(16, 13) },
      { id: 'e0000005-0000-0000-0000-000000000008', work_order_id: 'd0000004-0000-0000-0000-000000000002', from_status: 'qc',          to_status: 'done',        changed_by: 'QC Team',      created_at: ago(16, 15) },
      // WO-0037: queued → in_progress (overdue)
      { id: 'e0000005-0000-0000-0000-000000000009', work_order_id: 'd0000004-0000-0000-0000-000000000003', from_status: null,          to_status: 'queued',      changed_by: 'system',       created_at: ago(15) },
      { id: 'e0000005-0000-0000-0000-000000000010', work_order_id: 'd0000004-0000-0000-0000-000000000003', from_status: 'queued',      to_status: 'in_progress', changed_by: 'Arjun Singh',  created_at: ago(13) },
      // WO-0038: queued → in_progress (overdue)
      { id: 'e0000005-0000-0000-0000-000000000011', work_order_id: 'd0000004-0000-0000-0000-000000000004', from_status: null,          to_status: 'queued',      changed_by: 'system',       created_at: ago(13) },
      { id: 'e0000005-0000-0000-0000-000000000012', work_order_id: 'd0000004-0000-0000-0000-000000000004', from_status: 'queued',      to_status: 'in_progress', changed_by: 'Vikram Nair',  created_at: ago(11, 8) },
      // WO-0039: queued → in_progress → qc (overdue)
      { id: 'e0000005-0000-0000-0000-000000000013', work_order_id: 'd0000004-0000-0000-0000-000000000005', from_status: null,          to_status: 'queued',      changed_by: 'system',       created_at: ago(17) },
      { id: 'e0000005-0000-0000-0000-000000000014', work_order_id: 'd0000004-0000-0000-0000-000000000005', from_status: 'queued',      to_status: 'in_progress', changed_by: 'Ramesh Kumar', created_at: ago(15) },
      { id: 'e0000005-0000-0000-0000-000000000015', work_order_id: 'd0000004-0000-0000-0000-000000000005', from_status: 'in_progress', to_status: 'qc',          changed_by: 'Ramesh Kumar', created_at: ago(11, 10) },
    ])
    if (she) throw new Error(`Insert status_history: ${she.message}`)

    // ── Inventory Transactions ────────────────────────────────
    const { error: ite } = await sb.from('inventory_transactions').insert([
      { id: 'f0000006-0000-0000-0000-000000000001', raw_material_id: 'b0000002-0000-0000-0000-000000000001', work_order_id: 'd0000004-0000-0000-0000-000000000001', type: 'consumption', quantity: 54.000, notes: 'WO-2026-0035 — 50 t TMT-12', created_by: 'Ramesh Kumar', created_at: ago(22, 7) },
      { id: 'f0000006-0000-0000-0000-000000000002', raw_material_id: 'b0000002-0000-0000-0000-000000000003', work_order_id: 'd0000004-0000-0000-0000-000000000001', type: 'consumption', quantity:  0.750, notes: 'WO-2026-0035 — 50 t TMT-12', created_by: 'Ramesh Kumar', created_at: ago(22, 7) },
      { id: 'f0000006-0000-0000-0000-000000000003', raw_material_id: 'b0000002-0000-0000-0000-000000000001', work_order_id: 'd0000004-0000-0000-0000-000000000002', type: 'consumption', quantity: 31.500, notes: 'WO-2026-0036 — 30 t WR-06',  created_by: 'Suresh Patel', created_at: ago(18, 7) },
      { id: 'f0000006-0000-0000-0000-000000000004', raw_material_id: 'b0000002-0000-0000-0000-000000000003', work_order_id: 'd0000004-0000-0000-0000-000000000002', type: 'consumption', quantity:  0.300, notes: 'WO-2026-0036 — 30 t WR-06',  created_by: 'Suresh Patel', created_at: ago(18, 7) },
      { id: 'f0000006-0000-0000-0000-000000000005', raw_material_id: 'b0000002-0000-0000-0000-000000000002', work_order_id: null,                                   type: 'restock',     quantity: 500.000, notes: 'Routine monthly delivery — PO #4821', created_by: 'Procurement', created_at: ago(8, 10) },
    ])
    if (ite) throw new Error(`Insert inventory_transactions: ${ite.message}`)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[demo/reset]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
