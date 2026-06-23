import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'
import { calcAtRisk } from '@/lib/at-risk'

export async function GET() {
  try {
    const orders = await calcAtRisk(db())
    return NextResponse.json(orders)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
