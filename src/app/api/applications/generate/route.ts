import { NextRequest, NextResponse } from 'next/server'
import { generateAndSaveApplication } from '@/lib/generator'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { jobId } = await req.json()
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  try {
    const applicationId = await generateAndSaveApplication(jobId)
    return NextResponse.json({ success: true, applicationId })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
