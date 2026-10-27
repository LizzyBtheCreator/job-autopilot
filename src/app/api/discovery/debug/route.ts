import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const maxDuration = 30

export async function GET() {
  const db = supabaseAdmin()
  const log: Record<string, unknown> = {}

  // 1. Can we connect and read?
  const { data: jobs, error: readErr } = await db
    .from('discovered_jobs')
    .select('id, status, url')
    .limit(5)
  log.read_error = readErr?.message ?? null
  log.sample_jobs = jobs

  // 2. What statuses exist and how many?
  const { data: counts, error: countErr } = await db
    .from('discovered_jobs')
    .select('status')
  log.count_error = countErr?.message ?? null
  const statusMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    statusMap[row.status] = (statusMap[row.status] ?? 0) + 1
  }
  log.status_counts = statusMap
  log.total_rows = (counts ?? []).length

  // 3. Try one Serper query
  const key = process.env.SERPER_API_KEY
  log.serper_key_set = !!key
  let serperResult: unknown = null
  if (key) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: '"proposal manager" remote job -site:indeed.com', num: 3 }),
      })
      const data = await res.json()
      serperResult = {
        status: res.status,
        organic_count: data?.organic?.length ?? 0,
        first_result: data?.organic?.[0] ?? null,
        credits_message: data?.message ?? null,
      }
    } catch (e) {
      serperResult = { error: String(e) }
    }
  }
  log.serper_test = serperResult

  // 4. Try inserting a test row
  const testUrl = `https://debug-test-${Date.now()}.example.com/job/test`
  const { error: insertErr } = await db.from('discovered_jobs').insert({
    title: 'DEBUG TEST — DELETE ME',
    company: 'Debug',
    url: testUrl,
    description: 'test',
    role_category: 'govcon_other',
    role_type: 'compliance',
    is_remote: true,
    salary_raw: null,
    fit_score: 70,
    fit_notes: 'compliance',
    status: 'new',
  })
  log.insert_error = insertErr?.message ?? null
  log.insert_success = !insertErr

  // Clean up test row
  if (!insertErr) {
    await db.from('discovered_jobs').delete().eq('url', testUrl)
  }

  return NextResponse.json(log)
}
