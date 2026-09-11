import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const { id, ...fields } = JSON.parse(body)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const db = supabaseAdmin()

    // Do the update first — this is the critical operation
    const { error } = await db.from('applications').update(fields).eq('id', id)
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

    // If marking as submitted, increment today's applied count
    // Do this after the main update so a failure here doesn't block the status change
    if (fields.status === 'submitted') {
      try {
        const today = new Date().toISOString().split('T')[0]

        // Read only the minimal columns we need — no joins, no resume text
        const { data: app } = await db
          .from('applications')
          .select('status')
          .eq('id', id)
          .maybeSingle()

        // Get category separately to avoid joining large text fields
        const { data: jobRow } = await db
          .from('applications')
          .select('job_id')
          .eq('id', id)
          .maybeSingle()

        let categoryCol = 'sales_applied'
        if (jobRow?.job_id) {
          const { data: job } = await db
            .from('discovered_jobs')
            .select('category')
            .eq('id', jobRow.job_id)
            .maybeSingle()
          const cat = job?.category ?? 'sales'
          categoryCol = cat === 'govcon' ? 'govcon_applied'
            : cat === 'datacenter' ? 'datacenter_applied'
            : 'sales_applied'
        }

        // Only increment if it wasn't already submitted before this update
        if (app && app.status !== 'submitted') {
          await db.rpc('increment_applied', {
            p_date: today,
            p_count: 1,
            p_category_col: categoryCol,
          })
        }
      } catch (countErr) {
        // Non-fatal — don't fail the whole request over a counter
        console.error('[update] increment_applied failed:', countErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[update] caught exception:', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
