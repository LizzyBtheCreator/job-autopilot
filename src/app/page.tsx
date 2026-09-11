'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { DailyStats, DiscoveredJob, MasterProfile } from '@/lib/types'
import { PLATFORMS, ALL_PLATFORMS, type PlatformKey, TEMP_AGENCIES, ALL_TEMP_AGENCIES, type TempAgencyKey } from '@/lib/platforms'
import Link from 'next/link'
import StatsEditor from '@/components/StatsEditor'

const categoryColor: Record<string, string> = {
  sales: 'bg-blue-900 text-blue-300',
  govcon: 'bg-purple-900 text-purple-300',
  datacenter: 'bg-emerald-900 text-emerald-300',
}

const statusColor: Record<string, string> = {
  pending_review: 'bg-yellow-900 text-yellow-300',
  approved: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  applying: 'bg-blue-900 text-blue-300',
  applied: 'bg-teal-900 text-teal-300',
  archived: 'bg-gray-800 text-gray-400',
}

export default function Dashboard() {
  const [profile, setProfile] = useState<MasterProfile | null>(null)
  const [stats, setStats] = useState<DailyStats[]>([])
  const [recent, setRecent] = useState<DiscoveredJob[]>([])
  const [queue, setQueue] = useState<DiscoveredJob[]>([])
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>(ALL_PLATFORMS)
  const [selectedAgencies, setSelectedAgencies] = useState<TempAgencyKey[]>(ALL_TEMP_AGENCIES)
  const [showSources, setShowSources] = useState(false)

  function togglePlatform(key: PlatformKey) {
    setSelectedPlatforms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }
  function toggleAgency(key: TempAgencyKey) {
    setSelectedAgencies(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const load = useCallback(async () => {
    const [profileRes, statsRes, recentRes, queueRes] = await Promise.all([
      supabase.from('master_profile').select('*').single(),
      supabase.from('daily_stats').select('*').order('date', { ascending: false }).limit(7),
      supabase.from('discovered_jobs').select('*').order('discovered_at', { ascending: false }).limit(10),
      supabase.from('discovered_jobs').select('*').eq('status', 'pending_review').order('fit_score', { ascending: false }),
    ])
    setProfile(profileRes.data as MasterProfile | null)
    setStats((statsRes.data ?? []) as DailyStats[])
    setRecent((recentRes.data ?? []) as DiscoveredJob[])
    setQueue((queueRes.data ?? []) as DiscoveredJob[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const today = stats[0] ?? null
  const target = profile?.is_testing_phase ? profile?.daily_target : profile?.daily_target_production
  const applied = today?.applied ?? 0
  const pct = target ? Math.min(100, Math.round((applied / target) * 100)) : 0

  async function runDiscovery() {
    setDiscovering(true)
    setDiscoveryResult(null)
    try {
      const res = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: selectedPlatforms, tempAgencies: selectedAgencies }),
      })
      const data = await res.json()
      if (data.success) {
        setDiscoveryResult(`Found ${data.found} listings — ${data.saved} new jobs added to your queue!`)
        load()
      } else {
        setDiscoveryResult('Discovery failed. Try again.')
      }
    } catch {
      setDiscoveryResult('Could not reach server.')
    }
    setDiscovering(false)
  }

  if (loading) return <p className="text-gray-500 p-8">Loading dashboard...</p>

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-col items-end gap-2">
          {/* Source selector toggle */}
          <button
            onClick={() => setShowSources(s => !s)}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
          >
            {showSources ? 'Hide sources' : `Sources (${selectedPlatforms.length} ATS + ${selectedAgencies.length} temp)`}
          </button>

          {showSources && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-80 space-y-4">
              {/* ATS Platforms */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-purple-300 uppercase tracking-wide">ATS Platforms (GovCon/Compliance)</p>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-300"
                    onClick={() => setSelectedPlatforms(selectedPlatforms.length === ALL_PLATFORMS.length ? [] : ALL_PLATFORMS)}
                  >
                    {selectedPlatforms.length === ALL_PLATFORMS.length ? 'none' : 'all'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_PLATFORMS.map(key => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(key)}
                        onChange={() => togglePlatform(key)}
                        className="accent-purple-500"
                      />
                      <span className="text-xs text-gray-300">{PLATFORMS[key].label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Temp Agencies */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-orange-300 uppercase tracking-wide">Temp Agencies</p>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-300"
                    onClick={() => setSelectedAgencies(selectedAgencies.length === ALL_TEMP_AGENCIES.length ? [] : ALL_TEMP_AGENCIES)}
                  >
                    {selectedAgencies.length === ALL_TEMP_AGENCIES.length ? 'none' : 'all'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_TEMP_AGENCIES.map(key => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAgencies.includes(key)}
                        onChange={() => toggleAgency(key)}
                        className="accent-orange-500"
                      />
                      <span className="text-xs text-gray-300">{TEMP_AGENCIES[key].label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={runDiscovery}
            disabled={discovering}
            className="text-sm px-4 py-2 rounded-lg bg-purple-800 hover:bg-purple-700 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {discovering ? '🔍 Searching...' : '🔍 Run Discovery Now'}
          </button>
          {discoveryResult && (
            <p className="text-xs text-green-400">{discoveryResult}</p>
          )}
        </div>
      </div>
      <div>
        <p className="text-gray-400 text-sm mt-1">
          {profile?.is_testing_phase ? 'Testing phase' : 'Production'} &mdash; target {target ?? '—'} applications/day
        </p>
      </div>

      <StatsEditor today={today} />

      {/* Daily progress */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Discovered today', value: today?.discovered ?? 0 },
          { label: 'Pending review', value: queue.length },
          { label: 'Applied today', value: applied },
          { label: 'Daily target', value: target ?? '—' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">Today&apos;s applications</span>
          <span className="font-medium">{applied} / {target ?? '—'}</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {applied < (target ?? 0) && (
          <p className="text-yellow-400 text-xs mt-2">
            {(target ?? 0) - applied} more needed to hit today&apos;s target
          </p>
        )}
      </div>

      {/* Recent days history */}
      {stats.length > 1 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="font-semibold text-sm">Recent Activity</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-right px-4 py-2">Discovered</th>
                <th className="text-right px-4 py-2">Applied</th>
                <th className="text-right px-4 py-2">GovCon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stats.map(s => (
                <tr key={s.date} className="text-sm">
                  <td className="px-4 py-2 text-gray-400">{new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{s.discovered}</td>
                  <td className="px-4 py-2 text-right font-medium text-white">{s.applied}</td>
                  <td className="px-4 py-2 text-right text-purple-400">{s.govcon_applied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Category breakdown */}
      {today && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Sales', value: today.sales_applied, color: 'text-blue-400' },
            { label: 'GovCon', value: today.govcon_applied, color: 'text-purple-400' },
            { label: 'Data Center', value: today.datacenter_applied, color: 'text-emerald-400' },
          ].map(c => (
            <div key={c.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
              <p className={`text-sm font-medium ${c.color}`}>{c.label}</p>
              <p className="text-2xl font-bold mt-1">{c.value}</p>
              <p className="text-gray-500 text-xs">applied</p>
            </div>
          ))}
        </div>
      )}

      {/* Review queue preview */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Pending Review ({queue.length})</h2>
          <Link href="/queue" className="text-blue-400 text-sm hover:underline">View all &rarr;</Link>
        </div>
        {queue.length === 0 ? (
          <p className="text-gray-500 text-sm px-4 py-6">No jobs pending review. Run the discovery engine to find new matches.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {queue.slice(0, 5).map(job => (
              <li key={job.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{job.title}</p>
                  <p className="text-gray-400 text-xs">{job.company}</p>
                </div>
                {job.category && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[job.category]}`}>
                    {job.category}
                  </span>
                )}
                <span className="text-gray-400 text-xs">Score: {job.fit_score}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        {recent.length === 0 ? (
          <p className="text-gray-500 text-sm px-4 py-6">No jobs discovered yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {recent.map(job => (
              <li key={job.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{job.title}</p>
                  <p className="text-gray-400 text-xs">{job.company}</p>
                </div>
                {job.category && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[job.category]}`}>
                    {job.category}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[job.status]}`}>
                  {job.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
