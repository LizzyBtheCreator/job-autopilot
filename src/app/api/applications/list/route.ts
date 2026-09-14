import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('applications')
    .select('*, job:discovered_jobs(*)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Applications list error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, applications: data ?? [] })
}
