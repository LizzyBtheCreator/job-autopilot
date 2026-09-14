import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()

  // Try inserting a test govcon job
  const { data: d1, error: e1 } = await db.from('discovered_jobs').insert({
    title: 'TEST Proposal Manager Remote Federal',
    company: 'Test Co',
    url: `https://test-insert-${Date.now()}.example.com/job/1`,
    description: 'Test insert for debugging',
    category: 'govcon',
    is_remote: true,
    salary_raw: null,
    is_commission_only: false,
    fit_score: 75,
    fit_notes: 'test',
    status: 'pending_review',
  }).select()

  // Try inserting a test temp job
  const { data: d2, error: e2 } = await db.from('discovered_jobs').insert({
    title: 'TEST Proposal Coordinator Contract Remote',
    company: 'Test Agency',
    url: `https://test-insert-${Date.now()}.example.com/job/2`,
    description: 'Test temp insert for debugging',
    category: 'temp',
    is_remote: true,
    salary_raw: null,
    is_commission_only: false,
    fit_score: 65,
    fit_notes: 'test temp',
    status: 'pending_review',
  }).select()

  return NextResponse.json({
    govcon: { success: !e1, data: d1, error: e1?.message ?? null },
    temp: { success: !e2, data: d2, error: e2?.message ?? null },
  })
}
