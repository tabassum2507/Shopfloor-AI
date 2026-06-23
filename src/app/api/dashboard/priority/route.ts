import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

const COLORS: Record<string, string> = {
  urgent: '#EF4444',
  high:   '#F59E0B',
  medium: '#3B82F6',
  low:    '#9CA3AF',
}

export async function GET() {
  const { data, error } = await db()
    .from('work_orders')
    .select('priority')
    .neq('status', 'done')
    .neq('status', 'cancelled')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = { urgent: 0, high: 0, medium: 0, low: 0 }
  for (const row of data ?? []) {
    const p = row.priority as string
    if (p in counts) counts[p]++
  }

  const result = Object.entries(counts).map(([priority, count]) => ({
    name:  priority.charAt(0).toUpperCase() + priority.slice(1),
    value: count,
    color: COLORS[priority],
  }))

  return NextResponse.json(result)
}
