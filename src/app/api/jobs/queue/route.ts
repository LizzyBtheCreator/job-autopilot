import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const remoteOnly = searchParams.get('remoteOnly') === 'true'

  const db = supabaseAdmin()
  let q = db
    .from('discovered_jobs')
    .select('*')
    .eq('status', 'pending_review')
    .order('fit_score', { ascending: false })
    .limit(500)

  if (category && category !== 'all') q = q.eq('category', category)
  if (remoteOnly) q = q.eq('is_remote', true)

  const { data, error } = await q
  if (error) {
    console.error('Queue fetch error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Also get total count of all pending_review jobs regardless of filters
  const { count } = await db
    .from('discovered_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending_review')

  console.log(`Queue: returning ${data?.length ?? 0} jobs (total pending_review in DB: ${count})`)
  return NextResponse.json({ success: true, jobs: data ?? [], totalPending: count })
}
