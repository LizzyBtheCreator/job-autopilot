import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import type { RoleCategory } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { title, company, url, description, salary, roleCategory } = JSON.parse(body)

    if (!title || !company) {
      return NextResponse.json({ error: 'Title and company are required' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { data: job, error } = await db.from('discovered_jobs').insert({
      title,
      company,
      // Manual adds have no guaranteed unique URL from a real posting in some
      // cases — fall back to a synthetic one so the unique constraint holds.
      url: url || `manual:${randomUUID()}`,
      description: description || '',
      salary_raw: salary || null,
      role_category: (roleCategory as RoleCategory) || 'govcon_other',
      is_remote: true,
      is_entry_level: false,
      fit_score: 90,
      fit_notes: 'Manually added',
      status: 'new',
    }).select('id').single()

    if (error || !job) {
      console.error('[jobs/add] insert error:', error?.message)
      return NextResponse.json({ success: false, error: error?.message ?? 'Insert failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[jobs/add] exception:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
