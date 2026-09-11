import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const db = supabaseAdmin()
  const { data: profile } = await db.from('master_profile').select('*').single()
  if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

  return NextResponse.json({
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    }
  })
}
