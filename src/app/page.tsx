'use client'
import { useEffect, useState, useCallback } from 'react'
import type { DiscoveredJob, RoleCategory } from '@/lib/types'
import { PLATFORMS, ALL_PLATFORMS, type PlatformKey } from '@/lib/platforms'
import Link from 'next/link'

const ALL_CATEGORIES: RoleCategory[] = [
  'proposal_writer', 'capture_manager', 'compliance_manager',
  'contracts_administrator', 'business_development', 'govcon_other', 'general_remote',
]

const categoryLabel: Record<RoleCategory, string> = {
  proposal_writer: 'Proposal Writer',
  capture_manager: 'Capture Manager',
  compliance_manager: 'Compliance Manager',
  contracts_administrator: 'Contracts Administrator',
  business_development: 'Business Development',
  govcon_other: 'GovCon (Other)',
  general_remote: 'General Remote',
}

const statusColor: Record<string, string> = {
  new: 'bg-yellow-900 text-yellow-300',
  reviewed: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
  applied: 'bg-teal-900 text-teal-300',
}

interface Summary {
  discoveredToday: number
  discoveredWeek: number
  pendingReview: number
  appliedTotal: number
  recent: DiscoveredJob[]
  categoryCounts: Record<string, number>
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<RoleCategory[]>(ALL_CATEGORIES)
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformKey[]>(ALL_PLATFORMS)
  const [showSources, setShowSources] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/dashboard/summary')
    const data = await res.json()
    setSummary(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  function toggleCategory(c: RoleCategory) {
    setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }
  function togglePlatform(p: PlatformKey) {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function runDiscovery() {
    setDiscovering(true)
    setDiscoveryResult(null)
    try {
      const res = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selectedCategories, platforms: selectedPlatforms }),
      })
      const data = await res.json()
      if (data.success) {
        setDiscoveryResult(`Found ${data.found} listings — ${data.saved} new jobs added to your queue.`)
        load()
      } else {
        setDiscoveryResult('Discovery failed. Try again.')
      }
    } catch {
      setDiscoveryResult('Could not reach server.')
    }
    setDiscovering(false)
  }

  if (loading || !summary) return <p className="text-gray-500 p-8">Loading dashboard...</p>

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => setShowSources(s => !s)}
            className="text-xs text-gray-400 hover:text-gray-200 underline"
          >
            {showSources ? 'Hide sources' : `Sources (${selectedCategories.length} roles, ${selectedPlatforms.length} platforms)`}
          </button>

          {showSources && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-80 space-y-4">
              <div>
                <p className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-2">Role Categories</p>
                <div className="grid grid-cols-1 gap-1">
                  {ALL_CATEGORIES.map(c => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(c)}
                        onChange={() => toggleCategory(c)}
                        className="accent-purple-500"
                      />
                      <span className="text-xs text-gray-300">{categoryLabel[c]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-2">ATS Platforms</p>
                <div className="grid grid-cols-2 gap-1">
                  {ALL_PLATFORMS.map(key => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(key)}
                        onChange={() => togglePlatform(key)}
                        className="accent-blue-500"
                      />
                      <span className="text-xs text-gray-300">{PLATFORMS[key].label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={runDiscovery}
            disabled={discovering || selectedCategories.length === 0 || selectedPlatforms.length === 0}
            className="text-sm px-4 py-2 rounded-lg bg-purple-800 hover:bg-purple-700 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {discovering ? 'Searching...' : 'Run Search Now'}
          </button>
          {discoveryResult && <p className="text-xs text-green-400 max-w-xs text-right">{discoveryResult}</p>}
        </div>
      </div>

      {/* Live counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Discovered today', value: summary.discoveredToday },
          { label: 'Discovered this week', value: summary.discoveredWeek },
          { label: 'Pending review', value: summary.pendingReview },
          { label: 'Applied (all time)', value: summary.appliedTotal },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown of pending jobs */}
      {Object.keys(summary.categoryCounts).length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <p className="font-semibold text-sm mb-3">Pending review by role</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ALL_CATEGORIES.filter(c => summary.categoryCounts[c]).map(c => (
              <div key={c} className="text-center">
                <p className="text-xl font-bold">{summary.categoryCounts[c]}</p>
                <p className="text-gray-500 text-xs">{categoryLabel[c]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending review preview */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Pending Review ({summary.pendingReview})</h2>
          <Link href="/queue" className="text-blue-400 text-sm hover:underline">View all &rarr;</Link>
        </div>
        {summary.pendingReview === 0 ? (
          <p className="text-gray-500 text-sm px-4 py-6">No jobs pending review. Run a search to find new matches.</p>
        ) : (
          <p className="text-gray-500 text-sm px-4 py-6">
            {summary.pendingReview} job{summary.pendingReview === 1 ? '' : 's'} waiting for your review in the Job Search tab.
          </p>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold">Recently Discovered</h2>
        </div>
        {summary.recent.length === 0 ? (
          <p className="text-gray-500 text-sm px-4 py-6">No jobs discovered yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {summary.recent.map(job => (
              <li key={job.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{job.title}</p>
                  <p className="text-gray-400 text-xs">{job.company}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-900 text-purple-300">
                  {categoryLabel[job.role_category]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[job.status]}`}>
                  {job.status}
                </span>
                <span className="text-gray-500 text-xs whitespace-nowrap">
                  {new Date(job.discovered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
