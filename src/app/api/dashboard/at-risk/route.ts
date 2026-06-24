import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase-server'
import { calcAtRisk } from '@/lib/at-risk'

export async function GET() {
  const sb = await requireAuth()
  if (!sb) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const orders = await calcAtRisk(sb)
    return NextResponse.json(orders)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
