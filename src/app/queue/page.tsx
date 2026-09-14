'use client'
import { useEffect, useState } from 'react'
import type { DiscoveredJob, RoleCategory } from '@/lib/types'

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

const scoreColor = (s: number) =>
  s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400'

const EMPTY_FORM = { title: '', company: '', url: '', description: '', salary: '', roleCategory: 'govcon_other' as RoleCategory }

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function QueuePage() {
  const [jobs, setJobs] = useState<DiscoveredJob[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | RoleCategory>('all')
  const [remoteOnly, setRemoteOnly] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [addStatus, setAddStatus] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [totalPending, setTotalPending] = useState<number | null>(null)

  async function addJob() {
    if (!form.title || !form.company) return
    setAddLoading(true)
    setAddStatus('Saving job...')

    const addRes = await fetch('/api/jobs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const addData = await addRes.json()

    if (!addData.success || !addData.jobId) {
      setAddStatus('Failed to save. Try again.')
      setAddLoading(false)
      return
    }

    setAddStatus('Job saved! Generating tailored resume...')
    const genRes = await fetch('/api/applications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: addData.jobId }),
    })
    const genData = await genRes.json()

    if (!genData.success) {
      setAddStatus('Saved, but resume generation failed. Check Applications tab.')
    } else {
      setAddStatus('Done! Ready in your Applications tab.')
      setForm(EMPTY_FORM)
      setTimeout(() => { setShowAddForm(false); setAddStatus('') }, 2500)
    }
    setAddLoading(false)
  }

  async function load() {
    setLoading(true)
    const params = new URLSearchParams({ remoteOnly: String(remoteOnly) })
    if (filter !== 'all') params.set('roleCategory', filter)
    const res = await fetch(`/api/jobs/queue?${params}`)
    const data = await res.json()
    setJobs(data.jobs ?? [])
    setTotalPending(data.totalPending ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter, remoteOnly]) // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id: string) {
    setApplying(id)
    setStatus(s => ({ ...s, [id]: 'Generating resume...' }))
    const genRes = await fetch('/api/applications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: id }),
    })
    const genData = await genRes.json()
    if (!genData.success) {
      setStatus(s => ({ ...s, [id]: `Error: ${genData.error ?? 'unknown'}` }))
      setApplying(null)
      return
    }
    setStatus(s => ({ ...s, [id]: 'Ready in Applications!' }))
    setApplying(null)
    setTimeout(() => setJobs(j => j.filter(x => x.id !== id)), 2000)
  }

  async function reject(id: string) {
    setJobs(j => j.filter(x => x.id !== id))
    await fetch('/api/jobs/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Job Search Results</h1>
          <p className="text-gray-400 text-sm mt-1">{jobs.length} jobs shown{totalPending !== null ? ` (${totalPending} total pending review)` : ''}</p>
        </div>
      </div>

      {/* Manual Add */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowAddForm(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <span>+ Add Job Manually</span>
          <span className="text-gray-500">{showAddForm ? '▲' : '▼'}</span>
        </button>
        {showAddForm && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Job Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Capture Manager"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Company *</label>
                <input
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Booz Allen Hamilton"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Job URL</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Role Category</label>
                <select
                  value={form.roleCategory}
                  onChange={e => setForm(f => ({ ...f, roleCategory: e.target.value as RoleCategory }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
                >
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel[c]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Salary (optional)</label>
              <input
                value={form.salary}
                onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                placeholder="e.g. $120,000 - $150,000"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Job Description (paste full text)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Paste the full job description here for the best tailored resume..."
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={addJob}
                disabled={addLoading || !form.title || !form.company}
                className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {addLoading ? 'Working...' : 'Save & Generate Resume'}
              </button>
              {addStatus && (
                <p className={`text-sm ${addStatus.includes('Done') ? 'text-green-400' : addStatus.includes('Failed') ? 'text-red-400' : 'text-blue-400'}`}>
                  {addStatus}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            filter === 'all' ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {ALL_CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filter === c ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {categoryLabel[c]}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <button
          onClick={() => setRemoteOnly(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            remoteOnly ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Remote Only
        </button>
      </div>

      {/* Job list */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">No jobs waiting for review.</p>
          <p className="text-gray-600 text-sm mt-1">Run a search from the Dashboard to find new matches.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm">{job.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-900 text-purple-300">
                      {categoryLabel[job.role_category]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-gray-400 text-sm">{job.company}</p>
                    <span className="text-gray-600 text-xs">Found {fmtDate(job.discovered_at)}</span>
                    {job.is_remote === true && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">Remote</span>
                    )}
                    {job.is_remote === false && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">On-site</span>
                    )}
                  </div>
                  {(job.salary_raw || job.salary_min) && (
                    <p className="text-green-400 text-xs mt-1.5">
                      {job.salary_raw ?? `$${job.salary_min?.toLocaleString()}${job.salary_max ? `–$${job.salary_max.toLocaleString()}` : '+'}`}
                    </p>
                  )}
                  {job.fit_notes && (
                    <p className="text-gray-500 text-xs mt-1.5 line-clamp-2">{job.fit_notes}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className={`text-xl font-bold ${scoreColor(job.fit_score)}`}>{job.fit_score}</p>
                    <p className="text-gray-600 text-xs">fit score</p>
                  </div>
                  {status[job.id] && (
                    <p className={`text-xs text-right max-w-[160px] ${status[job.id].startsWith('Error') ? 'text-red-400' : 'text-blue-400'}`}>
                      {status[job.id]}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                      View
                    </a>
                    <button
                      onClick={() => reject(job.id)}
                      disabled={applying === job.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900 transition-colors disabled:opacity-40"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => approve(job.id)}
                      disabled={applying !== null}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 bg-green-900/50 text-green-300 hover:bg-green-900"
                    >
                      {applying === job.id ? 'Working...' : 'Generate Resume'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
