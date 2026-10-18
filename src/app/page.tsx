'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface DayStat {
  date: string
  discovered: number
  applied: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DayStat[]>([])
  const [queueCount, setQueueCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [statsRes, queueRes] = await Promise.all([
      supabase
        .from('daily_stats')
        .select('date, discovered, applied')
        .order('date', { ascending: false })
        .limit(14),
      supabase
        .from('discovered_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new'),
    ])
    setStats((statsRes.data ?? []) as DayStat[])
    setQueueCount(queueRes.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function runSearch() {
    setSearching(true)
    setSearchResult(null)
    try {
      const res = await fetch('/api/discovery/run', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setSearchResult(`Found ${data.found} listings — ${data.saved} new jobs added to your queue`)
        load()
      } else {
        setSearchResult(`Search failed: ${data.error}`)
      }
    } catch {
      setSearchResult('Search failed — check your connection')
    } finally {
      setSearching(false)
    }
  }

  const totalFound = stats.reduce((s, d) => s + (d.discovered ?? 0), 0)
  const totalApplied = stats.reduce((s, d) => s + (d.applied ?? 0), 0)

  function fmtDate(iso: string) {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-6">
        <span className="font-semibold text-white">Job Autopilot</span>
        <Link href="/" className="text-sm text-indigo-400 font-medium">Dashboard</Link>
        <Link href="/queue" className="text-sm text-gray-400 hover:text-white">Queue</Link>
        <Link href="/applications" className="text-sm text-gray-400 hover:text-white">Applications</Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Jobs in Queue</p>
            <p className="text-3xl font-bold text-white">{loading ? '—' : queueCount}</p>
            <Link href="/queue" className="text-xs text-indigo-400 mt-1 inline-block">View queue →</Link>
          </div>
          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Found (14 days)</p>
            <p className="text-3xl font-bold text-white">{loading ? '—' : totalFound}</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Applied (14 days)</p>
            <p className="text-3xl font-bold text-white">{loading ? '—' : totalApplied}</p>
            <Link href="/applications" className="text-xs text-indigo-400 mt-1 inline-block">View applications →</Link>
          </div>
        </div>

        {/* Search button */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 mb-1">Search for New Jobs</h2>
          <p className="text-xs text-gray-500 mb-4">
            Searches company career pages across all your job families. Results go directly into your queue.
          </p>
          <button
            onClick={runSearch}
            disabled={searching}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {searching ? 'Searching… this takes a few minutes' : 'Search for Jobs Now'}
          </button>
          {searchResult && (
            <p className={`mt-3 text-sm ${searchResult.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
              {searchResult}
            </p>
          )}
        </div>

        {/* Daily stats table */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="text-sm font-semibold text-gray-300">Activity — Last 14 Days</h2>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500 px-5 py-6">Loading…</p>
          ) : stats.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-6">No activity yet. Run a search to get started.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Date</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Jobs Found</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Applied</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.date} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-5 py-3 text-gray-300">{fmtDate(row.date)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={row.discovered > 0 ? 'text-indigo-400 font-medium' : 'text-gray-600'}>
                        {row.discovered}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={row.applied > 0 ? 'text-green-400 font-medium' : 'text-gray-600'}>
                        {row.applied}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </main>
    </div>
  )
}
