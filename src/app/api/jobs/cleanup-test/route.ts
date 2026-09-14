import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()
  const { error } = await db
    .from('discovered_jobs')
    .delete()
    .ilike('title', 'TEST %')
  return NextResponse.json({ success: !error, error: error?.message ?? null })
}
