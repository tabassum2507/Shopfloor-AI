import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase-server'

export async function GET() {
  const { data, error } = await db()
    .from('raw_materials')
    .select('id, name, sku, description, unit, stock_quantity, reorder_point, created_at, updated_at')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
