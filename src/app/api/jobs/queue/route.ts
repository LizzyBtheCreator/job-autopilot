import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const roleCategory = searchParams.get('roleCategory')
  const remoteOnly = searchParams.get('remoteOnly') === 'true'

  const db = supabaseAdmin()
  let q = db
    .from('discovered_jobs')
    .select('*')
    .eq('status', 'new')
    .order('fit_score', { ascending: false })
    .limit(500)

  if (roleCategory && roleCategory !== 'all') q = q.eq('role_category', roleCategory)
  if (remoteOnly) q = q.eq('is_remote', true)

  const { data, error } = await q
  if (error) {
    console.error('Queue fetch error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const { count } = await db
    .from('discovered_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new')

  return NextResponse.json({ success: true, jobs: data ?? [], totalPending: count })
}
