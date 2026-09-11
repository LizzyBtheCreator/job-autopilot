import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { title, company, url, description, salary } = JSON.parse(body)

    if (!title || !company) {
      return NextResponse.json({ error: 'Title and company are required' }, { status: 400 })
    }

    const db = supabaseAdmin()

    const { data: job, error } = await db.from('discovered_jobs').insert({
      title,
      company,
      url: url || null,
      description: description || '',
      salary_raw: salary || null,
      category: 'govcon',
      is_remote: true,
      is_commission_only: false,
      fit_score: 90,
      fit_notes: 'Manually added',
      status: 'pending_review',
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
