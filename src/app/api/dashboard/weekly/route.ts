import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

export async function GET() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data, error } = await db()
    .from('work_orders')
    .select('actual_end, quantity')
    .eq('status', 'done')
    .not('actual_end', 'is', null)
    .gte('actual_end', sevenDaysAgo.toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build an ordered 7-day map (today back to 6 days ago), all initialised to 0.
  const days: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days[d.toISOString().slice(0, 10)] = 0
  }

  for (const row of data ?? []) {
    const key = (row.actual_end as string).slice(0, 10)
    if (key in days) days[key] += Number(row.quantity)
  }

  // Noon avoids UTC/local timezone edge cases when formatting weekday labels.
  const result = Object.entries(days).map(([date, output]) => ({
    day: new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' }),
    date,
    output,
  }))

  return NextResponse.json(result)
}
