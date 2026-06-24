import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { requireAuth } from '@/lib/supabase-server'
import { calcAtRisk } from '@/lib/at-risk'

const PRIORITY_SORT: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
}

// Model to use — llama-3.1-70b-versatile was deprecated; use its successor
const MODEL = 'llama-3.3-70b-versatile'

// ─── POST /api/ai/query ───────────────────────────────────────

export async function POST(req: Request) {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 })
  }

  let body: { message?: string; history?: Array<{ role: string; content: string }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const message = (body.message ?? '').trim()
  const history = body.history ?? []

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  // ── Fetch production context from Supabase ───────────────

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [activeWORes, materialsRes, recentDoneRes, atRiskOrders] = await Promise.all([
    sb
      .from('work_orders')
      .select(`id, order_number, quantity, status, priority, scheduled_end, created_at, products ( name, unit )`)
      .neq('status', 'done')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(40),

    sb
      .from('raw_materials')
      .select('name, sku, unit, stock_quantity, reorder_point')
      .order('name'),

    sb
      .from('work_orders')
      .select(`order_number, quantity, actual_end, products ( name, unit )`)
      .eq('status', 'done')
      .not('actual_end', 'is', null)
      .gte('actual_end', sevenDaysAgo.toISOString())
      .order('actual_end', { ascending: false })
      .limit(30),

    calcAtRisk(sb).catch(() => []),
  ])

  const activeOrders = (activeWORes.data ?? []).sort(
    (a, b) => (PRIORITY_SORT[a.priority] ?? 9) - (PRIORITY_SORT[b.priority] ?? 9)
  )

  // ── Time-in-status via status_history ────────────────────

  const latestStatusDate = new Map<string, string>()
  const activeIds = activeOrders.map(o => o.id)

  if (activeIds.length > 0) {
    const { data: histRows } = await sb
      .from('status_history')
      .select('work_order_id, created_at')
      .in('work_order_id', activeIds)
      .order('created_at', { ascending: false })

    for (const row of histRows ?? []) {
      if (!latestStatusDate.has(row.work_order_id)) {
        latestStatusDate.set(row.work_order_id, row.created_at)
      }
    }
  }

  // ── Serialize context ─────────────────────────────────────

  const nowMs   = Date.now()
  const todayMs = today.getTime()

  const activeContext = activeOrders.map(wo => {
    const lastChange    = latestStatusDate.get(wo.id) ?? wo.created_at
    const hoursInStatus = Math.round((nowMs - new Date(lastChange).getTime()) / 3_600_000)
    const prod          = wo.products as unknown as { name: string; unit: string } | null
    const targetMs      = wo.scheduled_end ? new Date(wo.scheduled_end).getTime() : null
    const daysOverdue   = targetMs && targetMs < todayMs
      ? Math.floor((todayMs - targetMs) / 86_400_000)
      : 0

    return {
      order:           wo.order_number,
      product:         prod?.name ?? 'Unknown',
      qty:             `${wo.quantity} ${prod?.unit ?? ''}`.trim(),
      status:          wo.status,
      priority:        wo.priority,
      target_date:     wo.scheduled_end?.slice(0, 10) ?? null,
      ...(daysOverdue  ? { days_overdue: daysOverdue } : {}),
      hours_in_status: hoursInStatus,
    }
  })

  const inventoryContext = (materialsRes.data ?? []).map(m => ({
    material: m.name,
    stock:    `${m.stock_quantity} ${m.unit}`,
    reorder:  `${m.reorder_point} ${m.unit}`,
    alert:    m.stock_quantity <= 0
                ? 'OUT_OF_STOCK'
                : m.stock_quantity <= m.reorder_point
                ? 'CRITICAL'
                : m.stock_quantity <= m.reorder_point * 1.5
                ? 'LOW'
                : 'OK',
  }))

  const recentDone = (recentDoneRes.data ?? []).map(wo => {
    const prod = wo.products as unknown as { name: string; unit: string } | null
    return {
      order:     wo.order_number,
      product:   prod?.name ?? 'Unknown',
      qty:       `${wo.quantity} ${prod?.unit ?? ''}`.trim(),
      completed: (wo.actual_end as string)?.slice(0, 10),
    }
  })

  const todayCompletions = (recentDoneRes.data ?? []).filter(
    wo => wo.actual_end && new Date(wo.actual_end as string).getTime() >= todayMs
  )
  const todayTotal = todayCompletions.reduce((s, wo) => s + (wo.quantity ?? 0), 0)

  // ── System prompt ─────────────────────────────────────────

  const atRiskContext = (atRiskOrders as Array<{
    order_number: string; product: string; status: string
    target_date: string; predicted_end_date: string; days_at_risk: number; basis: string
  }>).map(o => ({
    order:     o.order_number,
    product:   o.product,
    status:    o.status,
    target:    o.target_date,
    predicted: o.predicted_end_date,
    days_late: o.days_at_risk,
    basis:     o.basis,
  }))

  const systemPrompt = `You are an AI production assistant for ShopFloor AI, a manufacturing ERP system. You help plant managers understand their shop floor status.

TODAY'S DATE: ${new Date().toISOString().slice(0, 10)}
TODAY'S OUTPUT: ${todayTotal} units across ${todayCompletions.length} completed orders

ACTIVE WORK ORDERS (${activeContext.length} total, sorted by priority):
${JSON.stringify(activeContext)}

AT-RISK ORDERS — predicted to miss target date (${atRiskContext.length} total):
${atRiskContext.length > 0 ? JSON.stringify(atRiskContext) : '[]'}
(Predictions use average time-in-status from completed orders. "basis" = product/global/fallback.)

RAW MATERIAL INVENTORY (${inventoryContext.length} materials):
${JSON.stringify(inventoryContext)}

COMPLETED LAST 7 DAYS (${recentDone.length} orders):
${JSON.stringify(recentDone)}

RULES:
- Reference specific order numbers (e.g. WO-2026-0042) when relevant
- Use bullet points for lists; be concise
- Bottleneck: flag orders with high hours_in_status for their priority level
- At-risk: when asked about late or at-risk orders, use the AT-RISK ORDERS section above
- Stock: highlight any material with alert CRITICAL or OUT_OF_STOCK
- Keep responses under 150 words
- For questions unrelated to this shop floor data, reply exactly: "I can only help with shop floor queries."
- Do not invent data not present above`

  // ── Call Groq with streaming ───────────────────────────────

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

  // Build messages array — let TypeScript infer the type from the SDK
  const messages = [
    { role: 'system' as const,    content: systemPrompt },
    ...history
      .filter(h => h.role === 'user' || h.role === 'assistant')
      .slice(-10)
      .map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ]

  // Create call is separated so TypeScript infers the stream type naturally;
  // any Groq API errors (bad model name, auth, quota) surface here and return
  // a proper JSON error instead of an unhandled 500.
  try {
    const groqStream = await groq.chat.completions.create({
      messages,
      model:       MODEL,
      stream:      true,
      max_tokens:  400,
      temperature: 0.3,
    })

    // Pipe Groq's AsyncIterable into a TransformStream that Next.js streams to the client.
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()

    ;(async () => {
      try {
        for await (const chunk of groqStream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) await writer.write(encoder.encode(text))
        }
      } catch (streamErr) {
        console.error('[ai/query] mid-stream error:', streamErr)
      } finally {
        writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Cache-Control':     'no-cache, no-store',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[ai/query] Groq error:', detail)
    return NextResponse.json({ error: `AI service error: ${detail}` }, { status: 502 })
  }
}
