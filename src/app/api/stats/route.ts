import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { date, applied, sales_applied, govcon_applied, datacenter_applied } = await req.json()
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const db = supabaseAdmin()
  const { error } = await db.from('daily_stats').upsert({
    date,
    applied: applied ?? 0,
    sales_applied: sales_applied ?? 0,
    govcon_applied: govcon_applied ?? 0,
    datacenter_applied: datacenter_applied ?? 0,
  }, { onConflict: 'date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
