import { NextRequest, NextResponse } from 'next/server'
import { fillApplication } from '@/lib/filler'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { applicationId } = await req.json()
  if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 })

  try {
    const result = await fillApplication(applicationId)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
