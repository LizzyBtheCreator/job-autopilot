import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()

  // Count by status
  const { data: statusCounts } = await db
    .from('discovered_jobs')
    .select('status')

  const counts: Record<string, number> = {}
  for (const row of statusCounts ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }

  // Count by category for pending_review
  const { data: catCounts } = await db
    .from('discovered_jobs')
    .select('category')
    .eq('status', 'pending_review')

  const cats: Record<string, number> = {}
  for (const row of catCounts ?? []) {
    cats[row.category ?? 'null'] = (cats[row.category ?? 'null'] ?? 0) + 1
  }

  // Sample 5 most recent rows
  const { data: recent } = await db
    .from('discovered_jobs')
    .select('title, category, status, discovered_at, url')
    .order('discovered_at', { ascending: false })
    .limit(5)

  return NextResponse.json({ byStatus: counts, pendingByCategory: cats, recentRows: recent })
}
