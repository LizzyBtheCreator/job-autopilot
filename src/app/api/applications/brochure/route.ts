import { NextRequest, NextResponse } from 'next/server'
import { generateFractionalBrochure } from '@/lib/generator'
import { supabaseAdmin } from '@/lib/supabase'
import type { DiscoveredJob } from '@/lib/types'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  try {
    const db = supabaseAdmin()

    const { data: job } = await db
      .from('discovered_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Pull existing resume so the brochure can align with it
    const { data: app } = await db
      .from('applications')
      .select('resume_text')
      .eq('job_id', jobId)
      .single()

    const html = await generateFractionalBrochure(job as DiscoveredJob, app?.resume_text ?? undefined)

    // Upsert into the applications table (row should already exist from resume generation)
    const { error } = await db
      .from('applications')
      .upsert(
        { job_id: jobId, fractional_brochure: html },
        { onConflict: 'job_id' }
      )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Brochure generate error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
