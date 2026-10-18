'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Job {
  id: string
  title: string
  company: string
  url: string
  role_type: string | null
  salary_raw: string | null
}

interface App {
  id: string
  job_id: string
  resume_text: string | null
  status: string
  applied_at: string | null
  notes: string | null
  updated_at: string
  job?: Job
}

type Tab = 'ready' | 'applied' | 'followup'

const TAB_LABELS: Record<Tab, string> = {
  ready:    'Ready to Apply',
  applied:  'Applied',
  followup: 'Following Up',
}

function tabForStatus(status: string): Tab {
  const s = status.toLowerCase()
  if (s === 'applied' || s === 'submitted') return 'applied'
  if (s === 'interviewing' || s === 'offer' || s === 'followup' || s === 'following up') return 'followup'
  return 'ready'
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('ready')
  const [selected, setSelected] = useState<App | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, job:discovered_jobs(id, title, company, url, role_type, salary_raw)')
      .order('updated_at', { ascending: false })
    setApps((data ?? []) as App[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function selectApp(app: App) {
    setSelected(app)
    setNotes(app.notes ?? '')
    setSaveMsg('')
    setCopied(false)
  }

  async function updateStatus(app: App, newStatus: string) {
    setSaving(true)
    setSaveMsg('')
    const fields: Record<string, string> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }
    if (newStatus.toLowerCase() === 'applied') {
      fields.applied_at = new Date().toISOString()
    }
    const res = await fetch('/api/applications/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id, ...fields }),
    })
    const data = await res.json()
    if (data.success) {
      setSaveMsg('Saved')
      const updated = { ...app, ...fields }
      setApps(prev => prev.map(a => a.id === app.id ? updated : a))
      setSelected(updated)
      setTab(tabForStatus(newStatus))
    } else {
      setSaveMsg(`Error: ${data.error}`)
    }
    setSaving(false)
  }

  async function saveNotes(app: App) {
    setSaving(true)
    setSaveMsg('')
    const res = await fetch('/api/applications/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: app.id, notes, updated_at: new Date().toISOString() }),
    })
    const data = await res.json()
    setSaveMsg(data.success ? 'Notes saved' : `Error: ${data.error}`)
    if (data.success) {
      setApps(prev => prev.map(a => a.id === app.id ? { ...a, notes } : a))
      setSelected(prev => prev ? { ...prev, notes } : prev)
    }
    setSaving(false)
  }

  function copyResume(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const tabApps = apps.filter(a => tabForStatus(a.status) === tab)

  const counts: Record<Tab, number> = {
    ready:    apps.filter(a => tabForStatus(a.status) === 'ready').length,
    applied:  apps.filter(a => tabForStatus(a.status) === 'applied').length,
    followup: apps.filter(a => tabForStatus(a.status) === 'followup').length,
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-6">
        <span className="font-semibold text-white">Job Autopilot</span>
        <Link href="/" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
        <Link href="/queue" className="text-sm text-gray-400 hover:text-white">Queue</Link>
        <Link href="/applications" className="text-sm text-indigo-400 font-medium">Applications</Link>
      </nav>

      <div className="flex" style={{ height: 'calc(100vh - 57px)' }}>

        {/* Left panel */}
        <div className="w-80 flex-shrink-0 border-r border-gray-800 flex flex-col">

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelected(null) }}
                className={`flex-1 py-3 text-xs font-medium transition-colors ${
                  tab === t
                    ? 'text-indigo-400 border-b-2 border-indigo-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {TAB_LABELS[t]}
                {counts[t] > 0 && (
                  <span className="ml-1 bg-gray-800 text-gray-300 rounded-full px-1.5 py-0.5 text-xs">
                    {counts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-gray-500 px-4 py-6">Loading…</p>
            ) : tabApps.length === 0 ? (
              <p className="text-sm text-gray-500 px-4 py-6">Nothing here yet.</p>
            ) : (
              tabApps.map(app => (
                <button
                  key={app.id}
                  onClick={() => selectApp(app)}
                  className={`w-full text-left px-4 py-4 border-b border-gray-800 hover:bg-gray-900 transition-colors ${
                    selected?.id === app.id ? 'bg-gray-900 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-white leading-tight line-clamp-1">
                    {app.job?.title ?? 'Untitled'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{app.job?.company ?? ''}</p>
                  {app.applied_at && (
                    <p className="text-xs text-gray-600 mt-1">Applied {fmtDate(app.applied_at)}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-600 text-sm">Select an application to view</p>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-w-2xl">

              {/* Job header */}
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.job?.title ?? 'Untitled'}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{selected.job?.company}</p>
                {selected.job?.salary_raw && (
                  <p className="text-sm text-green-400 mt-1">{selected.job.salary_raw}</p>
                )}
                {selected.job?.url && (
                  <a
                    href={selected.job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 mt-2 inline-block"
                  >
                    View job posting →
                  </a>
                )}
              </div>

              {/* Status actions */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {tab === 'ready' && (
                    <button
                      onClick={() => updateStatus(selected, 'Applied')}
                      disabled={saving}
                      className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      Mark Applied
                    </button>
                  )}
                  {tab === 'applied' && (
                    <button
                      onClick={() => updateStatus(selected, 'Interviewing')}
                      disabled={saving}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      Interviewing
                    </button>
                  )}
                  {(tab === 'applied' || tab === 'followup') && (
                    <button
                      onClick={() => updateStatus(selected, 'Offer')}
                      disabled={saving}
                      className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                      Received Offer
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(selected, 'Rejected')}
                    disabled={saving}
                    className="text-sm text-gray-500 hover:text-red-400 px-4 py-2 transition-colors"
                  >
                    Rejected
                  </button>
                </div>
                {saveMsg && (
                  <p className={`text-xs mt-2 ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                    {saveMsg}
                  </p>
                )}
              </div>

              {/* Resume */}
              {selected.resume_text && (
                <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <p className="text-xs font-medium text-gray-300 uppercase tracking-wide">Resume</p>
                    <button
                      onClick={() => copyResume(selected.resume_text!)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                  </div>
                  <pre className="text-xs text-gray-300 p-4 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                    {selected.resume_text}
                  </pre>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Notes</p>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Follow-up dates, contact names, recruiter info..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-indigo-500"
                  rows={4}
                />
                <button
                  onClick={() => saveNotes(selected)}
                  disabled={saving}
                  className="mt-2 text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                >
                  Save notes
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
