import { db } from '@/lib/supabase-server'

// ─── Types ────────────────────────────────────────────────────

const ACTIVE_STATUSES = ['queued', 'in_progress', 'qc'] as const
type ActiveStatus = (typeof ACTIVE_STATUSES)[number]

type StatusHours = Record<ActiveStatus, number>

export type AtRiskOrder = {
  id:                 string
  order_number:       string
  product:            string
  status:             string
  target_date:        string
  predicted_end_date: string
  days_at_risk:       number  // how many days prediction overshoots the target
  basis:              'product' | 'global' | 'fallback'
}

// Sensible estimates used when there is no historical data at all
const FALLBACK_AVG: StatusHours = {
  queued:      24,   // 1 day queued
  in_progress: 48,   // 2 days in production
  qc:          16,   // 16 hours in QC
}

type SbClient = ReturnType<typeof db>

// ─── Average computation ──────────────────────────────────────

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
}

type HistRow = { work_order_id: string; to_status: string; created_at: string }
type CompletedRow = { id: string; product_id: string; created_at: string }

function buildAverages(
  completedOrders: CompletedRow[],
  histRows:        HistRow[]
): { global: StatusHours; byProduct: Map<string, StatusHours> } {
  // For each completed order, keep the earliest timestamp per to_status
  const orderTs = new Map<string, Record<string, number>>()
  for (const row of histRows) {
    if (!orderTs.has(row.work_order_id)) orderTs.set(row.work_order_id, {})
    const ts  = new Date(row.created_at).getTime()
    const map = orderTs.get(row.work_order_id)!
    if (!(row.to_status in map) || ts < map[row.to_status]) map[row.to_status] = ts
  }

  type Sample = StatusHours & { productId: string }
  const samples: Sample[] = []

  for (const wo of completedOrders) {
    const ts    = orderTs.get(wo.id) ?? {}
    const tQue  = new Date(wo.created_at).getTime()
    const tIp   = ts['in_progress']
    const tQc   = ts['qc']
    const tDone = ts['done']

    if (!tIp || !tQc || !tDone) continue   // incomplete pipeline in history

    const hQ  = (tIp   - tQue) / 3_600_000
    const hIp = (tQc   - tIp)  / 3_600_000
    const hQc = (tDone - tQc)  / 3_600_000

    if (hQ < 0 || hIp < 0 || hQc < 0) continue  // clock-skew / data anomaly

    samples.push({ productId: wo.product_id, queued: hQ, in_progress: hIp, qc: hQc })
  }

  const global: StatusHours = {
    queued:      mean(samples.map(s => s.queued)),
    in_progress: mean(samples.map(s => s.in_progress)),
    qc:          mean(samples.map(s => s.qc)),
  }

  // Per-product averages — require ≥ 2 completed samples to be meaningful
  const byProductSamples = new Map<string, StatusHours[]>()
  for (const s of samples) {
    const list = byProductSamples.get(s.productId) ?? []
    list.push({ queued: s.queued, in_progress: s.in_progress, qc: s.qc })
    byProductSamples.set(s.productId, list)
  }

  const byProduct = new Map<string, StatusHours>()
  byProductSamples.forEach((list, pid) => {
    if (list.length < 2) return
    byProduct.set(pid, {
      queued:      mean(list.map((s: StatusHours) => s.queued)),
      in_progress: mean(list.map((s: StatusHours) => s.in_progress)),
      qc:          mean(list.map((s: StatusHours) => s.qc)),
    })
  })

  return { global, byProduct }
}

// ─── Main export ──────────────────────────────────────────────

export async function calcAtRisk(sb: SbClient): Promise<AtRiskOrder[]> {
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  // Phase 1: fetch completed orders (for averages) + active orders — in parallel
  const [completedRes, activeRes] = await Promise.all([
    sb
      .from('work_orders')
      .select('id, product_id, created_at')
      .eq('status', 'done')
      .not('actual_end', 'is', null)
      .gte('actual_end', sixtyDaysAgo.toISOString())
      .limit(200),

    sb
      .from('work_orders')
      .select('id, order_number, product_id, status, scheduled_end, created_at, products(name, unit)')
      .neq('status', 'done')
      .neq('status', 'cancelled')
      .not('scheduled_end', 'is', null),
  ])

  const completed = (completedRes.data ?? []) as CompletedRow[]
  const active    = activeRes.data ?? []

  if (active.length === 0) return []

  // Phase 2: single history query covering both completed and active orders
  const completedIds = completed.map(c => c.id)
  const activeIds    = active.map(a => a.id as string)
  const allIds       = [...completedIds, ...activeIds]

  let allHist: HistRow[] = []
  if (allIds.length > 0) {
    const { data } = await sb
      .from('status_history')
      .select('work_order_id, to_status, created_at')
      .in('work_order_id', allIds)
    allHist = (data ?? []) as HistRow[]
  }

  const completedSet = new Set(completedIds)
  const completedHist = allHist.filter(r => completedSet.has(r.work_order_id))
  const activeHist    = allHist.filter(r => !completedSet.has(r.work_order_id))

  // Build per-product and global averages from completed history
  const { global, byProduct } = buildAverages(completed, completedHist)
  const hasGlobal = global.queued > 0 || global.in_progress > 0 || global.qc > 0

  // Latest status-change timestamp per active order (= when current status began)
  const latestChange = new Map<string, number>()
  for (const row of activeHist) {
    const ts       = new Date(row.created_at).getTime()
    const existing = latestChange.get(row.work_order_id)
    if (!existing || ts > existing) latestChange.set(row.work_order_id, ts)
  }

  const now = Date.now()
  const STATUS_ORDER: ActiveStatus[] = ['queued', 'in_progress', 'qc']
  const atRisk: AtRiskOrder[] = []

  for (const wo of active) {
    const status = wo.status as string
    if (!(ACTIVE_STATUSES as readonly string[]).includes(status)) continue

    const s           = status as ActiveStatus
    const targetMs    = new Date(wo.scheduled_end as string).getTime()
    const sinceMs     = latestChange.get(wo.id as string) ?? new Date(wo.created_at as string).getTime()
    const hoursIn     = (now - sinceMs) / 3_600_000

    // Pick the most specific average available
    const productAvg = byProduct.get(wo.product_id as string)
    let avg:   StatusHours
    let basis: AtRiskOrder['basis']
    if (productAvg) {
      avg = productAvg; basis = 'product'
    } else if (hasGlobal) {
      avg = global;     basis = 'global'
    } else {
      avg = FALLBACK_AVG; basis = 'fallback'
    }

    // Remaining hours = leftover in current status + full time for each future status
    const currentIdx = STATUS_ORDER.indexOf(s)
    let remainingHours = Math.max(0, avg[s] - hoursIn)
    for (let i = currentIdx + 1; i < STATUS_ORDER.length; i++) {
      remainingHours += avg[STATUS_ORDER[i]]
    }

    const predictedEndMs = now + remainingHours * 3_600_000
    const daysAtRisk     = Math.ceil((predictedEndMs - targetMs) / 86_400_000)

    if (daysAtRisk > 0) {
      const prod = wo.products as unknown as { name: string; unit: string } | null
      atRisk.push({
        id:                 wo.id            as string,
        order_number:       wo.order_number  as string,
        product:            prod?.name       ?? 'Unknown',
        status,
        target_date:        (wo.scheduled_end as string).slice(0, 10),
        predicted_end_date: new Date(predictedEndMs).toISOString().slice(0, 10),
        days_at_risk:       daysAtRisk,
        basis,
      })
    }
  }

  atRisk.sort((a, b) => b.days_at_risk - a.days_at_risk)
  return atRisk
}
