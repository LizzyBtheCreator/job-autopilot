import { NextRequest, NextResponse } from 'next/server'
import { runDiscovery, ALL_PLATFORMS, ALL_TEMP_AGENCIES, type PlatformKey, type TempAgencyKey } from '@/lib/discovery'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const platforms: PlatformKey[] = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms
      : ALL_PLATFORMS
    const tempAgencies: TempAgencyKey[] = Array.isArray(body.tempAgencies) && body.tempAgencies.length > 0
      ? body.tempAgencies
      : ALL_TEMP_AGENCIES
    const result = await runDiscovery(platforms, tempAgencies)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
