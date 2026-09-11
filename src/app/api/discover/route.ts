import { NextResponse } from 'next/server'
import { runDiscovery } from '@/lib/discovery'

export const maxDuration = 300

export async function POST() {
  try {
    const result = await runDiscovery()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Discovery error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
