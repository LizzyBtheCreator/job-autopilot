import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { RoleCategory } from '@/lib/types'

export const dynamic = 'force-dynamic'

// All counts are computed live from the actual tables — no incrementing
// counter to drift out of sync with reality (that's what caused the old
// dashboard to report numbers that didn't match what was actually in the DB).
export async function GET() {
  const db = supabaseAdmin()
  const startOfToday = new Date()
  startOfToday.setUTCHours(0, 0, 0, 0)
  const todayIso = startOfToday.toISOString()
  const weekAgoIso = new Date(startOfToday.getTime() - 7 * 86400000).toISOString()

  const [
    discoveredToday,
    discoveredWeek,
    pendingReview,
    appliedTotal,
    recent,
    byCategory,
  ] = await Promise.all([
    db.from('discovered_jobs').select('*', { count: 'exact', head: true }).gte('discovered_at', todayIso),
    db.from('discovered_jobs').select('*', { count: 'exact', head: true }).gte('discovered_at', weekAgoIso),
    db.from('discovered_jobs').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    db.from('applications').select('*', { count: 'exact', head: true }).neq('status', 'New'),
    db.from('discovered_jobs').select('*').order('discovered_at', { ascending: false }).limit(10),
    db.from('discovered_jobs').select('role_category').eq('status', 'new'),
  ])

  const categoryCounts: Record<string, number> = {}
  for (const row of (byCategory.data ?? []) as { role_category: RoleCategory }[]) {
    categoryCounts[row.role_category] = (categoryCounts[row.role_category] ?? 0) + 1
  }

  return NextResponse.json({
    success: true,
    discoveredToday: discoveredToday.count ?? 0,
    discoveredWeek: discoveredWeek.count ?? 0,
    pendingReview: pendingReview.count ?? 0,
    appliedTotal: appliedTotal.count ?? 0,
    recent: recent.data ?? [],
    categoryCounts,
  })
}
