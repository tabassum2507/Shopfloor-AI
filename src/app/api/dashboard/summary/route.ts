import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

export async function GET() {
  const sb = db()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [queued, inProgress, qc, completedToday] = await Promise.all([
    sb.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    sb.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    sb.from('work_orders').select('*', { count: 'exact', head: true }).eq('status', 'qc'),
    sb.from('work_orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done')
      .gte('actual_end', today.toISOString()),
  ])

  return NextResponse.json({
    queued:         queued.count         ?? 0,
    inProgress:     inProgress.count     ?? 0,
    qc:             qc.count             ?? 0,
    completedToday: completedToday.count ?? 0,
  })
}
