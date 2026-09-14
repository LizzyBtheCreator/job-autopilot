'use client'
import { useEffect, useState } from 'react'
import type { Application, ApplicationStatus, DiscoveredJob, RoleCategory } from '@/lib/types'

type AppWithJob = Application & { job: DiscoveredJob }

const statusColor: Record<ApplicationStatus, string> = {
  New: 'bg-gray-800 text-gray-400',
  Applied: 'bg-blue-900 text-blue-300',
  Interview: 'bg-purple-900 text-purple-300',
  Offer: 'bg-emerald-900 text-emerald-300',
  Rejected: 'bg-red-900 text-red-400',
}

const categoryLabel: Record<RoleCategory, string> = {
  proposal_writer: 'Proposal Writer',
  capture_manager: 'Capture Manager',
  compliance_manager: 'Compliance Manager',
  contracts_administrator: 'Contracts Administrator',
  business_development: 'Business Development',
  govcon_other: 'GovCon (Other)',
  general_remote: 'General Remote',
}

const STATUSES: ApplicationStatus[] = ['New', 'Applied', 'Interview', 'Offer', 'Rejected']

function daysAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return '1 day ago'
  return `${diff} days ago`
}

function fmtDate(date: string | null | undefined) {
  if (!date) return null
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function apiFetch(url: string, data: Record<string, unknown>) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// Convert the [HEADER]/[SECTION]/[JOB] markers from generator.ts into a
// print-ready HTML document, opened in a new tab for Print > Save as PDF.
function toResumeHtml(text: string): string {
  if (!text.includes('[HEADER]')) {
    return text.split('\n').map(line => {
      const t = line.trim()
      if (!t) return '<br>'
      if (t.startsWith('- ')) return `<li>${t.slice(2)}</li>`
      return `<p>${t}</p>`
    }).join('\n')
  }
  const lines = text.split('\n')
  const html: string[] = []
  let i = 0
  let inList = false
  const closeList = () => { if (inList) { html.push('</ul>'); inList = false } }
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line === '[HEADER]') {
      i++
      const name = lines[i]?.trim() ?? ''; i++
      const contact = lines[i]?.trim() ?? ''; i++
      i++
      closeList()
      html.push(`<div class="header"><div class="name">${name}</div><div class="contact">${contact}</div><hr></div>`)
    } else if (line.startsWith('[SECTION]')) {
      closeList()
      html.push(`<h2>${line.replace('[SECTION]', '').replace('[/SECTION]', '')}</h2>`)
      i++
    } else if (line.startsWith('[JOB]')) {
      closeList()
      const job = line.replace('[JOB]', '').replace('[/JOB]', '')
      const [left, right] = job.split('|').map(s => s?.trim())
      html.push(`<div class="job-header"><span class="job-title">${left ?? job}</span>${right ? `<span class="job-dates">${right}</span>` : ''}</div>`)
      i++
    } else if (line.startsWith('- ')) {
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${line.slice(2)}</li>`)
      i++
    } else if (line === '' || line === '[/HEADER]') {
      closeList()
      i++
    } else {
      closeList()
      html.push(`<p>${line}</p>`)
      i++
    }
  }
  closeList()
  return html.join('\n')
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<AppWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AppWithJob | null>(null)
  const [tab, setTab] = useState<'resume' | 'notes' | 'job'>('resume')
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info')
  const [editedResume, setEditedResume] = useState('')
  const [notes, setNotes] = useState('')
  const [filterStatus, setFilterStatus] = useState<'active' | ApplicationStatus | 'all'>('active')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/applications/list')
    const data = await res.json()
    setApps((data.applications ?? []) as AppWithJob[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selected) {
      setEditedResume(selected.resume_text ?? '')
      setNotes(selected.notes ?? '')
    }
  }, [selected])

  function showMsg(text: string, type: 'info' | 'success' | 'error' = 'info') {
    setMsg(text)
    setMsgType(type)
    if (type !== 'error') setTimeout(() => setMsg(''), 3000)
  }

  async function saveResume() {
    if (!selected) return
    setSaving(true)
    const res = await apiFetch('/api/applications/update', { id: selected.id, resume_text: editedResume })
    const data = await res.json()
    if (data.success) showMsg('Saved!', 'success')
    else showMsg('Save failed: ' + (data.error ?? 'unknown error'), 'error')
    setSaving(false)
  }

  async function saveNotes() {
    if (!selected) return
    setSaving(true)
    const res = await apiFetch('/api/applications/update', { id: selected.id, notes })
    const data = await res.json()
    if (data.success) showMsg('Notes saved!', 'success')
    else showMsg('Save failed: ' + (data.error ?? 'unknown error'), 'error')
    setSaving(false)
  }

  async function regenerate() {
    if (!selected) return
    setRegenerating(true)
    showMsg('Regenerating resume...')
    const res = await fetch('/api/applications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: selected.job_id }),
    })
    const data = await res.json()
    if (data.success) {
      showMsg('Regenerated!', 'success')
      await load()
      const fresh = (await (await fetch('/api/applications/list')).json()).applications?.find((a: AppWithJob) => a.id === selected.id)
      if (fresh) { setSelected(fresh); setEditedResume(fresh.resume_text ?? '') }
    } else {
      showMsg('Regeneration failed. Try again.', 'error')
    }
    setRegenerating(false)
  }

  async function updateStatus(status: ApplicationStatus) {
    if (!selected) return
    const res = await apiFetch('/api/applications/update', { id: selected.id, status })
    const data = await res.json()
    if (data.success) {
      const updated = { ...selected, status }
      setSelected(updated)
      setApps(apps.map(a => a.id === selected.id ? { ...a, status } : a))
      showMsg('Status updated', 'success')
    } else {
      showMsg('Status update failed: ' + (data.error ?? 'unknown error'), 'error')
    }
  }

  function downloadPdf() {
    const company = selected?.job?.company ?? 'Application'
    const filename = `E. McMillan - ${company === 'See listing' ? (selected?.job?.title ?? 'Resume') : company}`
    const body = toResumeHtml(editedResume)
    const win = window.open('', '_blank')
    if (!win) { showMsg('Allow popups to download PDF', 'error'); return }
    win.document.write(`<!DOCTYPE html><html><head>
<title>${filename}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; padding: 0.75in; max-width: 8.5in; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 14px; }
  .name { font-size: 17pt; font-weight: bold; margin-bottom: 4px; }
  .contact { font-size: 10pt; color: #444; margin-bottom: 10px; }
  hr { border: none; border-top: 1px solid #999; margin: 0; }
  h2 { font-size: 11pt; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #bbb; margin: 14px 0 4px; padding-bottom: 2px; }
  .job-header { display: flex; justify-content: space-between; font-weight: bold; font-size: 10.5pt; margin: 8px 0 3px; }
  .job-dates { font-weight: normal; color: #444; font-size: 10pt; }
  ul { padding-left: 20px; margin: 3px 0 6px; }
  li { margin-bottom: 3px; line-height: 1.5; font-size: 10pt; }
  p { margin: 4px 0; line-height: 1.6; }
  @media print { body { padding: 0.5in; } @page { margin: 0.5in; size: letter; } }
</style>
</head><body>
${body}
<script>window.onload = function(){ document.title = ${JSON.stringify(filename)}; window.print(); }<\/script>
</body></html>`)
    win.document.close()
  }

  const filtered = apps.filter(a => {
    if (filterStatus === 'active') {
      if (['Rejected'].includes(a.status)) return false
    } else if (filterStatus !== 'all') {
      if (a.status !== filterStatus) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      const title = (a.job?.title ?? '').toLowerCase()
      const company = (a.job?.company ?? '').toLowerCase()
      if (!title.includes(q) && !company.includes(q)) return false
    }
    return true
  })

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-bold">Applications</h1>
          <span className="text-gray-500 text-xs">{filtered.length} / {apps.length}</span>
        </div>

        <input
          type="text"
          placeholder="Search company or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-shrink-0 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {(['active', ...STATUSES, 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                filterStatus === s ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500 text-sm">No applications here yet.</p>
          ) : (
            filtered.map(app => (
              <button
                key={app.id}
                onClick={() => { setSelected(app); setTab('resume'); setMsg('') }}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selected?.id === app.id ? 'border-blue-600 bg-gray-800' : 'border-gray-800 bg-gray-900 hover:bg-gray-800'
                }`}
              >
                <p className="font-medium text-sm truncate">{app.job?.title ?? 'Unknown role'}</p>
                <p className="text-gray-400 text-xs truncate">{app.job?.company}</p>
                <p className="text-gray-600 text-xs mt-0.5">
                  {app.applied_at ? `Applied ${daysAgo(app.applied_at)}` : `Found ${fmtDate(app.job?.discovered_at)}`}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {app.job?.role_category && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300">
                      {categoryLabel[app.job.role_category]}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[app.status]}`}>{app.status}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <p>Select an application to view details</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3 flex-shrink-0 gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{selected.job?.title}</h2>
                <p className="text-gray-400 text-sm">{selected.job?.company}</p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {selected.job?.url && (
                    <a href={selected.job.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs font-medium hover:underline">
                      View job posting ↗
                    </a>
                  )}
                  <span className="text-gray-500 text-xs">Fit: {selected.job?.fit_score}/100</span>
                  {selected.job?.salary_raw && <span className="text-gray-500 text-xs">{selected.job.salary_raw}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {msg && (
                  <p className={`text-xs text-right max-w-[240px] ${
                    msgType === 'success' ? 'text-green-400' : msgType === 'error' ? 'text-red-400' : 'text-blue-400'
                  }`}>{msg}</p>
                )}
                <div className="flex gap-2 flex-wrap justify-end">
                  <button onClick={saveResume} disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : 'Save Edits'}
                  </button>
                  <button onClick={regenerate} disabled={regenerating}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors">
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  <button onClick={downloadPdf}
                    className="text-xs px-3 py-1.5 rounded-lg bg-purple-900 hover:bg-purple-800 text-purple-200 font-medium transition-colors">
                    Resume PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mb-3 flex-shrink-0">
              {(['resume', 'notes', 'job'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                    tab === t ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}>
                  {t === 'resume' ? 'Resume' : t === 'notes' ? 'Status & Notes' : 'Job Details'}
                </button>
              ))}
            </div>

            {tab === 'job' ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                  <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Role</span><span className="text-gray-200">{selected.job?.title}</span></div>
                  <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Company</span><span className="text-gray-200">{selected.job?.company}</span></div>
                  <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Category</span><span className="text-gray-200">{selected.job?.role_category && categoryLabel[selected.job.role_category]}</span></div>
                  {selected.job?.salary_raw && <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Salary</span><span className="text-gray-200">{selected.job.salary_raw}</span></div>}
                  <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Fit Score</span><span className="text-gray-200">{selected.job?.fit_score}/100</span></div>
                  {selected.job?.fit_notes && <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Fit Notes</span><span className="text-gray-400 italic">{selected.job.fit_notes}</span></div>}
                  <div className="flex gap-3 text-sm"><span className="text-gray-500 w-28 flex-shrink-0">Found</span><span className="text-gray-200">{fmtDate(selected.job?.discovered_at)}</span></div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-medium mb-3 text-gray-300">Job Description</p>
                  {selected.job?.description ? (
                    <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{selected.job.description}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Full description not stored — view the original posting.</p>
                  )}
                </div>
              </div>
            ) : tab === 'notes' ? (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Application Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => updateStatus(s)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                          selected.status === s ? 'border-white text-white bg-gray-700' : 'border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {selected.applied_at && (
                    <p className="text-gray-500 text-xs mt-3">Applied {fmtDate(selected.applied_at)} ({daysAgo(selected.applied_at)})</p>
                  )}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 flex-1">
                  <p className="text-sm font-medium">Notes</p>
                  <textarea
                    className="flex-1 bg-gray-800 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-gray-600 min-h-[120px]"
                    placeholder="Interview notes, contacts, what they said, next steps..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                  <button onClick={saveNotes} disabled={saving}
                    className="self-end text-sm px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigator.clipboard.writeText(editedResume).then(() => showMsg('Copied to clipboard!', 'success'))}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-200 font-sans leading-relaxed resize-none focus:outline-none focus:border-gray-600"
                  value={editedResume}
                  onChange={e => setEditedResume(e.target.value)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
