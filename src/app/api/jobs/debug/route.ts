import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()

  // Count each status individually
  const statuses = ['pending_review', 'approved', 'rejected', 'applying', 'applied', 'archived']
  const byStatus: Record<string, number> = {}
  for (const s of statuses) {
    const { count } = await db.from('discovered_jobs').select('*', { count: 'exact', head: true }).eq('status', s)
    if (count) byStatus[s] = count
  }

  // Total count
  const { count: total } = await db.from('discovered_jobs').select('*', { count: 'exact', head: true })

  // 5 most recent
  const { data: recent, error: recentErr } = await db
    .from('discovered_jobs')
    .select('title, category, status, discovered_at')
    .order('discovered_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ total, byStatus, recentRows: recent, recentErr: recentErr?.message ?? null })
}
