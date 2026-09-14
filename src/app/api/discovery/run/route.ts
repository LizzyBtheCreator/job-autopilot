import { NextRequest, NextResponse } from 'next/server'
import { runDiscovery, ALL_PLATFORMS, type PlatformKey } from '@/lib/discovery'
import type { RoleCategory } from '@/lib/types'

export const maxDuration = 300

const ALL_CATEGORIES: RoleCategory[] = [
  'proposal_writer', 'capture_manager', 'compliance_manager',
  'contracts_administrator', 'business_development', 'govcon_other', 'general_remote',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const categories: RoleCategory[] = Array.isArray(body.categories) && body.categories.length > 0
      ? body.categories
      : ALL_CATEGORIES
    const platforms: PlatformKey[] = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms
      : ALL_PLATFORMS

    const result = await runDiscovery(categories, platforms)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Discovery error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
