import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { id, ...fields } = JSON.parse(body)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = supabaseAdmin()

    // Stamp applied_at the first time status flips to Applied
    if (fields.status === 'Applied' && !fields.applied_at) {
      const { data: existing } = await db.from('applications').select('applied_at').eq('id', id).maybeSingle()
      if (!existing?.applied_at) fields.applied_at = new Date().toISOString()
    }

    const { error } = await db.from('applications').update(fields).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    // Keep the job's own status in sync so the Queue page reflects reality
    if (fields.status === 'Applied') {
      const { data: app } = await db.from('applications').select('job_id').eq('id', id).maybeSingle()
      if (app?.job_id) {
        await db.from('discovered_jobs').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', app.job_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[update] caught exception:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
