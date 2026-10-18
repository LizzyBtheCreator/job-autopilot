import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cseId = process.env.GOOGLE_CSE_ID

  if (!apiKey || !cseId) {
    return NextResponse.json({ error: 'Missing GOOGLE_CSE_API_KEY or GOOGLE_CSE_ID' })
  }

  const query = '"proposal manager" remote federal -site:indeed.com'
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=3`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json({
      status: res.status,
      query,
      cseId,
      apiKeyPrefix: apiKey.slice(0, 8) + '...',
      resultCount: data?.items?.length ?? 0,
      firstResult: data?.items?.[0] ?? null,
      error: data?.error ?? null,
      searchInformation: data?.searchInformation ?? null,
    })
  } catch (err) {
    return NextResponse.json({ fetchError: String(err) })
  }
}
