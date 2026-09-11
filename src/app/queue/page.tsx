'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DiscoveredJob } from '@/lib/types'

const categoryColor: Record<string, string> = {
  temp: 'bg-orange-900 text-orange-300',
  sales: 'bg-blue-900 text-blue-300',
  govcon: 'bg-purple-900 text-purple-300',
  datacenter: 'bg-emerald-900 text-emerald-300',
  quickhire: 'bg-yellow-900 text-yellow-300',
}

const scoreColor = (s: number) =>
  s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400'

function getPlatform(url: string): { label: string; autoFill: boolean } {
  if (url.includes('greenhouse.io'))      return { label: 'Greenhouse', autoFill: true }
  if (url.includes('ashbyhq.com'))        return { label: 'Ashby', autoFill: true }
  if (url.includes('icims.com'))          return { label: 'iCIMS', autoFill: false }
  if (url.includes('smartrecruiters.com'))return { label: 'SmartRecruiters', autoFill: true }
  if (url.includes('bamboohr.com'))       return { label: 'BambooHR', autoFill: true }
  if (url.includes('myworkdayjobs.com'))  return { label: 'Workday', autoFill: false }
  if (url.includes('taleo.net'))          return { label: 'Taleo', autoFill: false }
  if (url.includes('lever.co'))           return { label: 'Lever', autoFill: false }
  return { label: 'Other', autoFill: false }
}

const EMPTY_FORM = { title: '', company: '', url: '', description: '', salary: '' }

export default function QueuePage() {
  const [jobs, setJobs] = useState<DiscoveredJob[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sales' | 'govcon' | 'datacenter' | 'quickhire' | 'temp'>('all')
  const [remoteOnly, setRemoteOnly] = useState(true)
  const [autoFillOnly, setAutoFillOnly] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, string>>({})
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [addStatus, setAddStatus] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  async function addJob() {
    if (!form.title || !form.company) return
    setAddLoading(true)
    setAddStatus('Saving job...')

    // Use server route so RLS is bypassed with service role key
    const encoder = new TextEncoder()
    const addRes = await fetch('/api/jobs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: encoder.encode(JSON.stringify({
        title: form.title,
        company: form.company,
        url: form.url || null,
        description: form.description,
        salary: form.salary || null,
      })),
    })
    const addData = await addRes.json()

    if (!addData.success || !addData.jobId) {
      setAddStatus('Failed to save. Try again.')
      setAddLoading(false)
      return
    }

    setAddStatus('Generating resume and cover letter...')
    const genRes = await fetch('/api/applications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: encoder.encode(JSON.stringify({ jobId: addData.jobId })),
    })
    const genData = await genRes.json()

    if (!genData.success) {
      setAddStatus('Generation failed. Check Applications tab.')
    } else {
      setAddStatus('Done! Ready in your Applications tab.')
      setForm(EMPTY_FORM)
      setTimeout(() => { setShowAddForm(false); setAddStatus('') }, 2500)
    }
    setAddLoading(false)
  }

  async function load() {
    setLoading(true)
    const q = supabase
      .from('discovered_jobs')
      .select('*')
      .eq('status', 'pending_review')
      .order('fit_score', { ascending: false })
    if (filter !== 'all') q.eq('category', filter)
    if (remoteOnly) q.eq('is_remote', true)
    const { data } = await q
    setJobs(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter, remoteOnly])

  const visibleJobs = autoFillOnly ? jobs.filter(j => getPlatform(j.url).autoFill) : jobs

  async function approve(id: string) {
    setApplying(id)
    setStatus(s => ({ ...s, [id]: 'Generating...' }))
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

  async function generateAll() {
    const pending = visibleJobs.filter(j => !status[j.id] && getPlatform(j.url).autoFill)
    if (pending.length === 0) return
    setBulkRunning(true)
    setBulkProgress({ done: 0, total: pending.length })
    const initial: Record<string, string> = {}
    pending.forEach(j => { initial[j.id] = 'Queued...' })
    setStatus(s => ({ ...s, ...initial }))

    const BATCH = 5
    let done = 0
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH)
      await Promise.all(batch.map(async job => {
        setStatus(s => ({ ...s, [job.id]: 'Generating...' }))
        try {
          const res = await fetch('/api/applications/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id }),
          })
          const data = await res.json()
          setStatus(s => ({ ...s, [job.id]: data.success ? 'Ready!' : 'Failed' }))
        } catch {
          setStatus(s => ({ ...s, [job.id]: 'Failed' }))
        }
        done++
        setBulkProgress({ done, total: pending.length })
      }))
    }
    setBulkRunning(false)
    setTimeout(() => load(), 2500)
  }

  async function reject(id: string) {
    await supabase.from('discovered_jobs').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
    setJobs(j => j.filter(x => x.id !== id))
  }

  const autoFillCount = visibleJobs.filter(j => getPlatform(j.url).autoFill && !status[j.id]).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Review Queue</h1>
          <p className="text-gray-400 text-sm mt-1">{visibleJobs.length} jobs shown</p>
        </div>
        {autoFillCount > 0 && (
          <button
            onClick={generateAll}
            disabled={bulkRunning || applying !== null}
            className="text-sm px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {bulkRunning && bulkProgress
              ? `Generating ${bulkProgress.done}/${bulkProgress.total}...`
              : `Generate All Auto-Fill (${autoFillCount})`}
          </button>
        )}
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
                  placeholder="e.g. Proposal Manager"
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
                <label className="text-xs text-gray-400 mb-1 block">Salary (optional)</label>
                <input
                  value={form.salary}
                  onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                  placeholder="e.g. $120,000 - $150,000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                />
              </div>
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
                {addLoading ? 'Working...' : 'Generate Resume & Cover Letter'}
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
        {(['all', 'temp', 'govcon', 'quickhire', 'sales', 'datacenter'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filter === f ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f === 'govcon' ? 'GovCon' : f === 'datacenter' ? 'Data Center' : f === 'quickhire' ? '⚡ Quick Hire' : f === 'temp' ? '⚡ Temp/Contract' : 'Sales'}
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
        <button
          onClick={() => setAutoFillOnly(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            autoFillOnly ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Auto-Fill Only
        </button>
      </div>

      {/* Progress bar */}
      {bulkRunning && bulkProgress && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Generating resumes and cover letters...</span>
            <span className="text-green-400 font-medium">{bulkProgress.done} / {bulkProgress.total}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }}
            />
          </div>
          <p className="text-gray-500 text-xs mt-2">When done, everything will be in your Applications tab ready to review.</p>
        </div>
      )}

      {/* Job list */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : visibleJobs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">Queue is empty.</p>
          <p className="text-gray-600 text-sm mt-1">Run the discovery engine to find new job matches.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleJobs.map(job => {
            const platform = getPlatform(job.url)
            return (
              <div
                key={job.id}
                className={`bg-gray-900 border rounded-xl p-4 ${
                  platform.autoFill ? 'border-gray-800' : 'border-orange-900/40'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title + badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm">{job.title}</p>
                      {job.category && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[job.category]}`}>
                          {job.category === 'datacenter' ? 'Data Center' : job.category === 'govcon' ? 'GovCon' : job.category === 'quickhire' ? '⚡ Quick Hire' : job.category === 'temp' ? '⚡ Temp/Contract' : 'Sales'}
                        </span>
                      )}
                    </div>

                    {/* Company + meta row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-400 text-sm">{job.company}</p>
                      {/* Remote badge */}
                      {job.is_remote === true && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">Remote</span>
                      )}
                      {job.is_remote === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">On-site</span>
                      )}
                      {/* Platform + auto-fill status */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        platform.autoFill
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-orange-900/40 text-orange-300'
                      }`}>
                        {platform.autoFill ? `✓ ${platform.label}` : `⚠ ${platform.label} — Manual`}
                      </span>
                    </div>

                    {/* Salary */}
                    {(job.salary_raw || job.salary_min) && (
                      <p className="text-green-400 text-xs mt-1.5">
                        {job.salary_raw ?? `$${job.salary_min?.toLocaleString()}${job.salary_max ? `–$${job.salary_max.toLocaleString()}` : '+'}`}
                      </p>
                    )}

                    {/* Fit notes */}
                    {job.fit_notes && (
                      <p className="text-gray-500 text-xs mt-1.5 line-clamp-2">{job.fit_notes}</p>
                    )}
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-xl font-bold ${scoreColor(job.fit_score)}`}>{job.fit_score}</p>
                      <p className="text-gray-600 text-xs">fit score</p>
                    </div>
                    {status[job.id] && (
                      <p className={`text-xs text-right max-w-[160px] ${status[job.id] === 'Failed' ? 'text-red-400' : 'text-blue-400'}`}>
                        {status[job.id]}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        View
                      </a>
                      <button
                        onClick={() => reject(job.id)}
                        disabled={bulkRunning || applying === job.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/50 text-red-300 hover:bg-red-900 transition-colors disabled:opacity-40"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => approve(job.id)}
                        disabled={bulkRunning || applying !== null}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                          platform.autoFill
                            ? 'bg-green-900/50 text-green-300 hover:bg-green-900'
                            : 'bg-orange-900/50 text-orange-300 hover:bg-orange-900'
                        }`}
                      >
                        {applying === job.id ? 'Working...' : platform.autoFill ? 'Generate' : 'Generate (Manual)'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
