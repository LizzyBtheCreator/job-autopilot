import { NextResponse } from 'next/server'
import { exec } from 'child_process'

export async function POST() {
  return new Promise<NextResponse>(resolve => {
    // Kill any Chromium processes launched by Playwright
    exec('pkill -f "chromium" || true', () => {
      resolve(NextResponse.json({ success: true }))
    })
  })
}
