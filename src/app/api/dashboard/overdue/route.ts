import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

export async function GET() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await db()
    .from('work_orders')
    .select(`
      id, order_number, quantity, status, priority, scheduled_end,
      products ( name, unit )
    `)
    .lt('scheduled_end', today.toISOString())
    .neq('status', 'done')
    .neq('status', 'cancelled')
    .not('scheduled_end', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const todayMs = today.getTime()
  const result = (data ?? []).map(wo => ({
    ...wo,
    days_overdue: Math.floor(
      (todayMs - new Date(wo.scheduled_end as string).getTime()) / 86_400_000
    ),
  }))

  result.sort((a, b) => b.days_overdue - a.days_overdue)

  return NextResponse.json(result)
}
