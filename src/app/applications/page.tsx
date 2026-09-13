'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Application, DiscoveredJob } from '@/lib/types'

type AppWithJob = Application & { job: DiscoveredJob }

const statusColor: Record<string, string> = {
  draft: 'bg-gray-800 text-gray-400',
  ready: 'bg-blue-900 text-blue-300',
  filled: 'bg-yellow-900 text-yellow-300',
  submitted: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-400',
  interviewing: 'bg-purple-900 text-purple-300',
  offer: 'bg-emerald-900 text-emerald-300',
  closed: 'bg-gray-800 text-gray-500',
  unavailable: 'bg-orange-900 text-orange-300',
}

const categoryColor: Record<string, string> = {
  sales: 'bg-blue-900 text-blue-300',
  govcon: 'bg-purple-900 text-purple-300',
  datacenter: 'bg-emerald-900 text-emerald-300',
  quickhire: 'bg-yellow-900 text-yellow-300',
}

const STATUSES = ['draft','ready','filled','submitted','rejected','interviewing','offer','closed','unavailable'] as const

function getPlatform(url: string): { label: string; autoFill: boolean } {
  if (url.includes('greenhouse.io'))       return { label: 'Greenhouse', autoFill: true }
  if (url.includes('ashbyhq.com'))         return { label: 'Ashby', autoFill: true }
  if (url.includes('smartrecruiters.com')) return { label: 'SmartRecruiters', autoFill: true }
  if (url.includes('bamboohr.com'))        return { label: 'BambooHR', autoFill: true }
  if (url.includes('icims.com'))           return { label: 'iCIMS', autoFill: false }
  if (url.includes('myworkdayjobs.com'))   return { label: 'Workday', autoFill: false }
  if (url.includes('taleo.net'))           return { label: 'Taleo', autoFill: false }
  if (url.includes('lever.co'))            return { label: 'Lever', autoFill: false }
  return { label: 'Other', autoFill: false }
}

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

// Returns {label, color} for thank-you note status — only for interviewing apps
function thankYouStatus(app: AppWithJob): { label: string; color: string } | null {
  if (app.status !== 'interviewing') return null
  if (app.thank_you_sent_at) return { label: 'Thank you sent', color: 'text-green-400' }
  // 24-hour window from interview_date if set, otherwise from when status became interviewing (use updated_at or created_at as proxy)
  const base = app.interview_date
    ? new Date(app.interview_date).getTime() + 86400000   // interview date + 24h
    : app.updated_at
      ? new Date(app.updated_at).getTime() + 86400000
      : null
  if (!base) return { label: 'Send thank you note', color: 'text-yellow-400' }
  const hoursLeft = Math.ceil((base - Date.now()) / 3600000)
  if (hoursLeft < 0) return { label: 'Thank you note overdue', color: 'text-red-400' }
  if (hoursLeft <= 4) return { label: `Send thank you — ${hoursLeft}h left`, color: 'text-red-400' }
  if (hoursLeft <= 12) return { label: `Send thank you — ${hoursLeft}h left`, color: 'text-yellow-400' }
  return { label: 'Send thank you note today', color: 'text-yellow-400' }
}

// Safe fetch wrapper — encodes body as UTF-8 bytes to avoid ByteString errors
// when resume/cover letter text contains bullets, em-dashes, or other non-Latin1 chars
async function apiFetch(url: string, data: Record<string, unknown>) {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(JSON.stringify(data))
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bytes,
  })
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<AppWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AppWithJob | null>(null)
  const [tab, setTab] = useState<'resume' | 'cover' | 'brochure' | 'followup' | 'job'>('resume')
  const [generatingBrochure, setGeneratingBrochure] = useState(false)
  const [markingThankYou, setMarkingThankYou] = useState(false)
  const [interviewDateInput, setInterviewDateInput] = useState('')
  const [filling, setFilling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info')
  const [editedResume, setEditedResume] = useState('')
  const [editedCover, setEditedCover] = useState('')
  const [followUpNote, setFollowUpNote] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [showHidden, setShowHidden] = useState(false)
  const [search, setSearch] = useState('')
  const [greenhouseOnly, setGreenhouseOnly] = useState(false)
  const [bulkFilling, setBulkFilling] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{done: number; total: number} | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('applications')
      .select('*, job:discovered_jobs(*)')
      .order('created_at', { ascending: false })
    setApps((data ?? []) as AppWithJob[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selected) {
      setEditedResume(selected.resume_text ?? '')
      setEditedCover(selected.cover_letter ?? '')
      setFollowUpNote(selected.notes ?? '')
    }
  }, [selected])

  function showMsg(text: string, type: 'info' | 'success' | 'error' = 'info') {
    setMsg(text)
    setMsgType(type)
    if (type !== 'error') setTimeout(() => setMsg(''), 3000)
  }

  async function saveEdits() {
    if (!selected) return
    setSaving(true)
    const res = await apiFetch('/api/applications/update', { id: selected.id, resume_text: editedResume, cover_letter: editedCover })
    const data = await res.json()
    if (data.success) showMsg('Saved!', 'success')
    else showMsg('Save failed: ' + (data.error ?? 'unknown error'), 'error')
    setSaving(false)
  }

  async function generateBrochure() {
    if (!selected) return
    setGeneratingBrochure(true)
    showMsg('Generating fractional brochure...')
    const res = await fetch('/api/applications/brochure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: selected.job_id }),
    })
    const data = await res.json()
    if (data.success) {
      showMsg('Brochure ready!', 'success')
      // Refresh the selected application
      const fresh = await supabase.from('applications').select('*, job:discovered_jobs(*)').eq('id', selected.id).single()
      if (fresh.data) setSelected(fresh.data as AppWithJob)
      await load()
    } else {
      showMsg('Brochure generation failed. Try again.', 'error')
    }
    setGeneratingBrochure(false)
  }

  function downloadBrochure() {
    if (!selected?.fractional_brochure) return
    const company = selected.job?.company ?? 'Application'
    const blob = new Blob([selected.fractional_brochure], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    // Trigger print dialog after a short delay so fonts load
    if (win) setTimeout(() => { try { win.print() } catch { /* ignore */ } }, 1200)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    showMsg(`Brochure opened for ${company} — use Print > Save as PDF`, 'info')
  }

  async function regenerate() {
    if (!selected) return
    setRegenerating(true)
    showMsg('Regenerating resume and cover letter...')
    const res = await fetch('/api/applications/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: selected.job_id }),
    })
    const data = await res.json()
    if (data.success) {
      showMsg('Regenerated!', 'success')
      await load()
      // Refresh selected with new content
      const fresh = await supabase.from('applications').select('*, job:discovered_jobs(*)').eq('id', selected.id).single()
      if (fresh.data) {
        const updated = fresh.data as AppWithJob
        setSelected(updated)
        setEditedResume(updated.resume_text ?? '')
        setEditedCover(updated.cover_letter ?? '')
      }
    } else {
      showMsg('Regeneration failed. Try again.', 'error')
    }
    setRegenerating(false)
  }

  async function openFiller() {
    if (!selected) return
    setFilling(true)
    showMsg('Opening application form...')
    await fetch('/api/applications/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: selected.id }),
    })
    showMsg('Form filled — review in browser and click Submit!', 'success')
    setFilling(false)
    load()
  }

  async function closeBrowsers() {
    await fetch('/api/applications/close-browsers', { method: 'POST' })
    showMsg('All browser windows closed.', 'success')
  }

  async function updateStatus(status: string) {
    if (!selected) return
    const extraFields: Record<string, string> = {}
    if (status === 'submitted' && !selected.submitted_at) {
      extraFields.submitted_at = new Date().toISOString()
    }
    const res = await apiFetch('/api/applications/update', { id: selected.id, status, ...extraFields })
    const data = await res.json()
    if (data.success) {
      const updated = { ...selected, status: status as Application['status'], ...extraFields }
      setSelected(updated)
      setApps(apps.map(a => a.id === selected.id ? { ...a, ...updated } : a))
      showMsg('Status updated', 'success')
    } else {
      showMsg('Status update failed: ' + (data.error ?? 'unknown error'), 'error')
    }
  }

  async function markThankYou() {
    if (!selected) return
    setMarkingThankYou(true)
    const now = new Date().toISOString()
    const fields: Record<string, string | null> = { thank_you_sent_at: now }
    if (interviewDateInput) fields.interview_date = interviewDateInput
    const res = await apiFetch('/api/applications/update', { id: selected.id, ...fields })
    const data = await res.json()
    if (data.success) {
      const updated = { ...selected, thank_you_sent_at: now, ...(interviewDateInput ? { interview_date: interviewDateInput } : {}) }
      setSelected(updated)
      setApps(apps.map(a => a.id === selected.id ? { ...a, ...updated } : a))
      showMsg('Thank you note marked as sent!', 'success')
      setInterviewDateInput('')
    } else {
      showMsg('Could not save. Try again.', 'error')
    }
    setMarkingThankYou(false)
  }

  async function saveInterviewDate() {
    if (!selected || !interviewDateInput) return
    const res = await apiFetch('/api/applications/update', { id: selected.id, interview_date: interviewDateInput })
    const data = await res.json()
    if (data.success) {
      const updated = { ...selected, interview_date: interviewDateInput }
      setSelected(updated)
      setApps(apps.map(a => a.id === selected.id ? { ...a, interview_date: interviewDateInput } : a))
      showMsg('Interview date saved', 'success')
      setInterviewDateInput('')
    }
  }

  async function clearThankYou() {
    if (!selected) return
    const res = await apiFetch('/api/applications/update', { id: selected.id, thank_you_sent_at: null })
    const data = await res.json()
    if (data.success) {
      const updated = { ...selected, thank_you_sent_at: null }
      setSelected(updated)
      setApps(apps.map(a => a.id === selected.id ? { ...a, thank_you_sent_at: null } : a))
    }
  }

  function downloadPdf(content: string, type: 'resume' | 'cover') {
    const company = selected?.job?.company
    const title = selected?.job?.title ?? 'Application'
    const label = (!company || company === 'See listing') ? title.slice(0, 50) : company
    const filename = type === 'resume'
      ? `E. McMillan - ${label}`
      : `Cover Letter - ${label}`

    // Convert structured text markers to clean HTML, then open in a print window
    function toHtml(text: string): string {
      if (!text.includes('[HEADER]')) {
        // plain text fallback
        return text.split('\n').map(line => {
          const t = line.trim()
          if (!t) return '<br>'
          if (t.startsWith('- ') || t.startsWith('• ')) return `<li>${t.slice(2)}</li>`
          if (t.match(/^[A-Z][A-Z\s&|\/\-]{4,}$/) && t.length < 60) return `<h2>${t}</h2>`
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
          const contact = lines[i]?.trim() ?? ''; i++ // [/HEADER]
          i++
          closeList()
          html.push(`<div class="header"><div class="name">${name}</div><div class="contact">${contact}</div><hr></div>`)
        } else if (line.startsWith('[SECTION]')) {
          closeList()
          const sec = line.replace('[SECTION]', '').replace('[/SECTION]', '')
          html.push(`<h2>${sec}</h2>`)
          i++
        } else if (line.startsWith('[JOB]')) {
          closeList()
          const job = line.replace('[JOB]', '').replace('[/JOB]', '')
          const parts = job.split('|')
          const left = parts[0]?.trim() ?? job
          const right = parts[1]?.trim() ?? ''
          html.push(`<div class="job-header"><span class="job-title">${left}</span>${right ? `<span class="job-dates">${right}</span>` : ''}</div>`)
          i++
        } else if (line.startsWith('- ') || line.startsWith('• ')) {
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

    const body = toHtml(content)
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
  @media print {
    body { padding: 0.5in; }
    @page { margin: 0.5in; size: letter; }
  }
</style>
</head><body>
${body}
<script>window.onload = function(){ document.title = ${JSON.stringify(filename)}; window.print(); }<\/script>
</body></html>`)
    win.document.close()
  }

  async function saveFollowUp() {
    if (!selected) return
    setSaving(true)
    const res = await apiFetch('/api/applications/update', { id: selected.id, notes: followUpNote })
    const data = await res.json()
    if (data.success) showMsg('Follow-up notes saved!', 'success')
    else showMsg('Save failed: ' + (data.error ?? 'unknown error'), 'error')
    setSaving(false)
  }

  async function archiveApp(id: string) {
    await apiFetch('/api/applications/update', { id, status: 'closed' })
    setApps(prev => prev.map(a => a.id === id ? { ...a, status: 'closed' as Application['status'] } : a))
    if (selected?.id === id) setSelected(null)
  }

  const HIDDEN_STATUSES = ['closed', 'rejected', 'unavailable']

  const filtered = apps.filter(a => {
    const isHidden = HIDDEN_STATUSES.includes(a.status)
    if (!showHidden && isHidden) return false
    if (filterStatus === 'active') {
      if (isHidden) return false
    } else if (filterStatus !== 'all') {
      if (a.status !== filterStatus) return false
    }
    if (greenhouseOnly) {
      if (!a.job?.url?.includes('greenhouse.io')) return false
      if (a.job?.is_remote === false) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      const title = (a.job?.title ?? '').toLowerCase()
      const company = (a.job?.company ?? '').toLowerCase()
      if (!title.includes(q) && !company.includes(q)) return false
    }
    return true
  })

  const selectedIndex = selected ? filtered.findIndex(a => a.id === selected.id) : -1
  function goNext() {
    if (filtered.length === 0) return
    const next = filtered[(selectedIndex + 1) % filtered.length]
    setSelected(next); setTab('resume'); setMsg('')
  }
  function goPrev() {
    if (filtered.length === 0) return
    const prev = filtered[(selectedIndex - 1 + filtered.length) % filtered.length]
    setSelected(prev); setTab('resume'); setMsg('')
  }

  const readyGreenhouse = apps.filter(a =>
    a.status === 'ready' &&
    a.job?.url?.includes('greenhouse.io') &&
    a.job?.is_remote !== false
  )

  async function bulkFillGreenhouse() {
    if (readyGreenhouse.length === 0) return
    setBulkFilling(true)
    setBulkProgress({ done: 0, total: readyGreenhouse.length })
    for (let i = 0; i < readyGreenhouse.length; i++) {
      const app = readyGreenhouse[i]
      try {
        await fetch('/api/applications/fill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: app.id }),
        })
      } catch { /* continue */ }
      setBulkProgress({ done: i + 1, total: readyGreenhouse.length })
      await new Promise(r => setTimeout(r, 3000))
    }
    setBulkFilling(false)
    setBulkProgress(null)
    load()
  }

  const submittedApps = apps.filter(a => ['submitted', 'interviewing', 'offer'].includes(a.status))

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between flex-shrink-0">
          <h1 className="text-xl font-bold">Applications</h1>
          <span className="text-gray-500 text-xs">{filtered.length} / {apps.length}</span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search company or title..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-shrink-0 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        {/* Thank-you note alert — interviews only */}
        {(() => {
          const needsTY = apps.filter(a => {
            const ty = thankYouStatus(a)
            return ty && !a.thank_you_sent_at
          })
          const overdue = needsTY.filter(a => thankYouStatus(a)?.color === 'text-red-400')
          if (needsTY.length === 0) return null
          return (
            <div className={`border rounded-xl p-3 flex-shrink-0 ${overdue.length > 0 ? 'bg-red-900/30 border-red-700/60' : 'bg-yellow-900/30 border-yellow-700/60'}`}>
              <p className={`text-xs font-medium ${overdue.length > 0 ? 'text-red-400' : 'text-yellow-300'}`}>
                {overdue.length > 0
                  ? `${overdue.length} thank-you note${overdue.length > 1 ? 's' : ''} overdue`
                  : `${needsTY.length} interview${needsTY.length > 1 ? 's' : ''} — send your thank-you note`}
              </p>
              <p className="text-yellow-600 text-xs mt-0.5">Go to Follow Up tab to mark as sent.</p>
            </div>
          )
        })()}

        {/* Status filter */}
        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {['active', 'ready', 'submitted', 'interviewing', 'offer'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                filterStatus === s ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {s === 'active' ? 'Active' : s}
            </button>
          ))}
          <button
            onClick={() => { setShowHidden(v => !v); setFilterStatus('all') }}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              showHidden ? 'bg-gray-600 text-gray-200' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
            }`}
          >
            {showHidden ? 'Hide closed' : 'Show hidden'}
          </button>
        </div>

        {/* Greenhouse filter + bulk submit */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => setGreenhouseOnly(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              greenhouseOnly ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Greenhouse + Remote Only
          </button>
          {readyGreenhouse.length > 0 && (
            <button
              onClick={bulkFillGreenhouse}
              disabled={bulkFilling}
              className="text-xs px-3 py-1.5 rounded-full font-medium bg-green-800 hover:bg-green-700 text-green-200 disabled:opacity-50 transition-colors"
            >
              {bulkFilling && bulkProgress
                ? `Submitting ${bulkProgress.done}/${bulkProgress.total}...`
                : `Submit All Greenhouse Ready (${readyGreenhouse.length})`}
            </button>
          )}
        </div>

        {/* Prev / Next navigation */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={goPrev}
              className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors">
              ← Prev
            </button>
            <span className="text-gray-500 text-xs whitespace-nowrap">
              {selectedIndex >= 0 ? `${selectedIndex + 1} / ${filtered.length}` : `${filtered.length}`}
            </span>
            <button onClick={goNext}
              className="flex-1 text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors">
              Next →
            </button>
          </div>
        )}

        {/* App list */}
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
                  selected?.id === app.id
                    ? 'border-blue-600 bg-gray-800'
                    : 'border-gray-800 bg-gray-900 hover:bg-gray-800'
                }`}
              >
                <p className="font-medium text-sm truncate">{app.job?.title ?? 'Unknown role'}</p>
                <p className="text-gray-400 text-xs truncate">{app.job?.company}</p>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {app.submitted_at
                    ? <p className="text-gray-500 text-xs">Applied {daysAgo(app.submitted_at)} ({fmtDate(app.submitted_at)})</p>
                    : <p className="text-gray-600 text-xs">Added {fmtDate(app.created_at)}</p>
                  }
                  {(() => { const ty = thankYouStatus(app); return ty ? <p className={`text-xs font-medium ${ty.color}`}>{ty.label}</p> : null })()}
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {app.job?.category && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor[app.job.category]}`}>
                      {app.job.category === 'govcon' ? 'GovCon' : app.job.category === 'datacenter' ? 'Data Center' : app.job.category === 'quickhire' ? '⚡ Quick Hire' : 'Sales'}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[app.status]}`}>
                    {app.status}
                  </span>
                  {app.job?.url && (() => {
                    const p = getPlatform(app.job!.url)
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.autoFill ? 'bg-green-900/40 text-green-400' : 'bg-orange-900/40 text-orange-300'}`}>
                        {p.autoFill ? `✓ ${p.label}` : `⚠ ${p.label}`}
                      </span>
                    )
                  })()}
                  {app.job?.is_remote === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">On-site</span>
                  )}
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
            {/* Header */}
            <div className="flex items-start justify-between mb-3 flex-shrink-0 gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{selected.job?.title}</h2>
                <p className="text-gray-400 text-sm">{selected.job?.company}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {selected.job?.url && (() => {
                    const p = getPlatform(selected.job!.url)
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.autoFill ? 'bg-green-900/40 text-green-400' : 'bg-orange-900/40 text-orange-300'}`}>
                        {p.autoFill ? `✓ ${p.label}` : `⚠ ${p.label}`}
                      </span>
                    )
                  })()}
                  {selected.job?.is_remote === true && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">Remote</span>
                  )}
                  {selected.job?.is_remote === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">On-site</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {selected.job?.url && (
                    <a href={selected.job.url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 text-xs font-medium hover:underline">
                      View job posting ↗
                    </a>
                  )}
                  {selected.job?.fit_score && (
                    <span className="text-gray-500 text-xs">Fit: {selected.job.fit_score}/100</span>
                  )}
                  {selected.job?.salary_raw && (
                    <span className="text-gray-500 text-xs">{selected.job.salary_raw}</span>
                  )}
                  {selected.submitted_at && (
                    <span className="text-gray-500 text-xs">Applied {daysAgo(selected.submitted_at)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {msg && (
                  <p className={`text-xs text-right max-w-[240px] ${
                    msgType === 'success' ? 'text-green-400' :
                    msgType === 'error' ? 'text-red-400' : 'text-blue-400'
                  }`}>{msg}</p>
                )}
                <div className="flex gap-2 flex-wrap justify-end">
                  <button onClick={saveEdits} disabled={saving}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : 'Save Edits'}
                  </button>
                  <button onClick={regenerate} disabled={regenerating || filling}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-800 hover:bg-blue-700 text-white font-medium disabled:opacity-50 transition-colors">
                    {regenerating ? 'Regenerating...' : 'Regenerate'}
                  </button>
                  {editedResume && (
                    <button onClick={() => downloadPdf(editedResume, 'resume')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-900 hover:bg-purple-800 text-purple-200 font-medium transition-colors">
                      📄 Resume PDF
                    </button>
                  )}
                  {editedCover && (
                    <button onClick={() => downloadPdf(editedCover, 'cover')}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-900 hover:bg-purple-800 text-purple-200 font-medium transition-colors">
                      📄 Cover PDF
                    </button>
                  )}
                  <button
                    onClick={selected.fractional_brochure ? downloadBrochure : generateBrochure}
                    disabled={generatingBrochure}
                    className="text-xs px-3 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-200 font-medium disabled:opacity-50 transition-colors">
                    {generatingBrochure ? 'Building...' : selected.fractional_brochure ? '📋 Brochure PDF' : '📋 Gen Brochure'}
                  </button>
                  <button onClick={openFiller} disabled={filling || regenerating}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-50 transition-colors">
                    {filling ? 'Opening...' : 'Fill & Apply'}
                  </button>
                  <button onClick={closeBrowsers}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-red-300 font-medium transition-colors">
                    Close Windows
                  </button>
                  <button onClick={() => archiveApp(selected.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium transition-colors">
                    Hide
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3 flex-shrink-0 flex-wrap">
              {(['resume', 'cover', 'brochure', 'followup', 'job'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                    tab === t ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  } ${t === 'brochure' && selected.fractional_brochure ? 'ring-1 ring-indigo-500' : ''}`}>
                  {t === 'resume' ? 'Resume' : t === 'cover' ? 'Cover Letter' : t === 'brochure' ? (selected.fractional_brochure ? '📋 Brochure' : '📋 Brochure') : t === 'followup' ? 'Follow Up' : 'Job Details'}
                </button>
              ))}
            </div>

            {/* Content */}
            {tab === 'job' ? (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Key info */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-500 w-28 flex-shrink-0">Role</span>
                    <span className="text-gray-200">{selected.job?.title}</span>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-500 w-28 flex-shrink-0">Company</span>
                    <span className="text-gray-200">{selected.job?.company}</span>
                  </div>
                  {selected.job?.category && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-28 flex-shrink-0">Category</span>
                      <span className="text-gray-200 capitalize">{selected.job.category}</span>
                    </div>
                  )}
                  {selected.job?.salary_raw && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-28 flex-shrink-0">Salary</span>
                      <span className="text-gray-200">{selected.job.salary_raw}</span>
                    </div>
                  )}
                  {selected.job?.fit_score && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-28 flex-shrink-0">Fit Score</span>
                      <span className="text-gray-200">{selected.job.fit_score}/100</span>
                    </div>
                  )}
                  {selected.job?.fit_notes && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-28 flex-shrink-0">Fit Notes</span>
                      <span className="text-gray-400 italic">{selected.job.fit_notes}</span>
                    </div>
                  )}
                  {selected.job?.url && (
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-28 flex-shrink-0">Posting URL</span>
                      <a href={selected.job.url} target="_blank" rel="noopener noreferrer"
                        className="text-blue-400 hover:underline break-all">{selected.job.url}</a>
                    </div>
                  )}
                </div>
                {/* Description */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-medium mb-3 text-gray-300">Job Description</p>
                  {selected.job?.description ? (
                    <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{selected.job.description}</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Full description not stored — view the original posting.</p>
                      {selected.job?.url && (
                        <a href={selected.job.url} target="_blank" rel="noopener noreferrer"
                          className="inline-block text-sm text-blue-400 hover:underline">
                          Open job posting →
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : tab === 'followup' ? (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                {/* Status updater */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Application Status</p>
                  <div className="flex flex-wrap gap-2">
                    {STATUSES.map(s => (
                      <button key={s} onClick={() => updateStatus(s)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${
                          selected.status === s
                            ? 'border-white text-white bg-gray-700'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Application Timeline</p>
                  <div className="space-y-2.5">
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-32 flex-shrink-0">Job discovered</span>
                      <span className="text-gray-300">{fmtDate(selected.job?.discovered_at) ?? 'Unknown'}</span>
                    </div>
                    <div className="flex gap-3 text-sm">
                      <span className="text-gray-500 w-32 flex-shrink-0">App created</span>
                      <span className="text-gray-300">{fmtDate(selected.created_at)} ({daysAgo(selected.created_at)})</span>
                    </div>
                    {selected.form_filled_at && (
                      <div className="flex gap-3 text-sm">
                        <span className="text-gray-500 w-32 flex-shrink-0">Form filled</span>
                        <span className="text-blue-300">{fmtDate(selected.form_filled_at)} ({daysAgo(selected.form_filled_at)})</span>
                      </div>
                    )}
                    {selected.submitted_at ? (
                      <div className="flex gap-3 text-sm">
                        <span className="text-gray-500 w-32 flex-shrink-0">Submitted</span>
                        <span className="text-green-400">{fmtDate(selected.submitted_at)} ({daysAgo(selected.submitted_at)})</span>
                      </div>
                    ) : (
                      <div className="flex gap-3 text-sm">
                        <span className="text-gray-500 w-32 flex-shrink-0">Submitted</span>
                        <span className="text-gray-600 italic">Not yet — set status to Submitted to record date</span>
                      </div>
                    )}
                    {/* Interview date row */}
                    <div className="flex gap-3 text-sm items-center">
                      <span className="text-gray-500 w-32 flex-shrink-0">Interview date</span>
                      {selected.interview_date ? (
                        <span className="text-purple-300">{fmtDate(selected.interview_date)}</span>
                      ) : (
                        <span className="text-gray-600 italic">Not set</span>
                      )}
                    </div>
                    {/* Thank you row */}
                    {selected.thank_you_sent_at ? (
                      <div className="flex gap-3 text-sm items-center">
                        <span className="text-gray-500 w-32 flex-shrink-0">Thank you sent</span>
                        <span className="text-green-400">{fmtDate(selected.thank_you_sent_at)} ({daysAgo(selected.thank_you_sent_at)})</span>
                        <button onClick={clearThankYou} className="text-xs text-gray-600 hover:text-gray-400 underline ml-1">undo</button>
                      </div>
                    ) : selected.status === 'interviewing' ? (
                      <div className="flex gap-3 text-sm items-center">
                        <span className="text-gray-500 w-32 flex-shrink-0">Thank you</span>
                        <span className={`font-medium ${thankYouStatus(selected)?.color ?? 'text-yellow-400'}`}>
                          {thankYouStatus(selected)?.label ?? 'Send thank-you note'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Thank-you action — only for interviewing apps */}
                {selected.status === 'interviewing' && !selected.thank_you_sent_at && (
                  <div className={`border rounded-xl p-4 ${
                    thankYouStatus(selected)?.color === 'text-red-400'
                      ? 'bg-red-900/20 border-red-700/40'
                      : 'bg-purple-900/20 border-purple-700/40'
                  }`}>
                    <p className={`text-sm font-medium mb-3 ${
                      thankYouStatus(selected)?.color === 'text-red-400' ? 'text-red-300' : 'text-purple-300'
                    }`}>
                      Send your thank-you note
                    </p>
                    {/* Interview date input */}
                    <div className="flex gap-2 items-center mb-3">
                      <label className="text-xs text-gray-400 flex-shrink-0">Interview date</label>
                      <input
                        type="date"
                        value={interviewDateInput}
                        onChange={e => setInterviewDateInput(e.target.value)}
                        className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      />
                      {interviewDateInput && interviewDateInput !== selected.interview_date && (
                        <button onClick={saveInterviewDate}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                          Save date
                        </button>
                      )}
                    </div>
                    <button onClick={markThankYou} disabled={markingThankYou}
                      className="text-sm px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-medium disabled:opacity-50 transition-colors">
                      {markingThankYou ? 'Saving...' : 'Mark Thank You Sent'}
                    </button>
                  </div>
                )}

                {selected.thank_you_sent_at && (
                  <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3">
                    <p className="text-green-400 text-sm font-medium">Thank-you note sent {fmtDate(selected.thank_you_sent_at)}</p>
                    <p className="text-green-700 text-xs mt-0.5">Update the status if you hear back.</p>
                  </div>
                )}

                {/* Notes */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 flex-1">
                  <p className="text-sm font-medium">Notes</p>
                  <textarea
                    className="flex-1 bg-gray-800 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-gray-600 min-h-[120px]"
                    placeholder="Interview notes, contacts, what they said, next steps..."
                    value={followUpNote}
                    onChange={e => setFollowUpNote(e.target.value)}
                    spellCheck={true}
                  />
                  <button onClick={saveFollowUp} disabled={saving}
                    className="self-end text-sm px-4 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            ) : tab === 'brochure' ? (
              <div className="flex-1 flex flex-col gap-3 min-h-0">
                {selected.fractional_brochure ? (
                  <>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={downloadBrochure}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-200 font-medium transition-colors">
                        Open + Print to PDF
                      </button>
                      <button onClick={generateBrochure} disabled={generatingBrochure}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium disabled:opacity-50 transition-colors">
                        {generatingBrochure ? 'Regenerating...' : 'Regenerate Brochure'}
                      </button>
                      <p className="text-xs text-gray-500 self-center">Opens in new tab. Choose Print &rarr; Save as PDF.</p>
                    </div>
                    <iframe
                      srcDoc={selected.fractional_brochure}
                      className="flex-1 rounded-xl border border-gray-800 bg-white"
                      sandbox="allow-same-origin"
                      title="Fractional brochure preview"
                    />
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="text-4xl">📋</div>
                    <p className="text-gray-300 font-medium">No brochure generated yet</p>
                    <p className="text-gray-500 text-sm max-w-sm">The fractional brochure is a company-specific sales document you send alongside your resume, positioning yourself as a fractional hire to remove cost and risk barriers.</p>
                    <button onClick={generateBrochure} disabled={generatingBrochure}
                      className="text-sm px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white font-medium disabled:opacity-50 transition-colors">
                      {generatingBrochure ? 'Building brochure...' : 'Generate Fractional Brochure'}
                    </button>
                    {generatingBrochure && (
                      <p className="text-indigo-400 text-xs">Researching the company and building your brochure. This takes about 30 seconds...</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                {/* Copy / Download toolbar */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      const text = tab === 'resume' ? editedResume : editedCover
                      navigator.clipboard.writeText(text).then(() => showMsg('Copied to clipboard!', 'success'))
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => {
                      const text = tab === 'resume' ? editedResume : editedCover
                      const filename = tab === 'resume'
                        ? `Resume_${selected.job?.company ?? 'Application'}.txt`
                        : `CoverLetter_${selected.job?.company ?? 'Application'}.txt`
                      const blob = new Blob([text], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = filename
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                  >
                    Download .txt
                  </button>
                </div>
                <textarea
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-200 font-sans leading-relaxed resize-none focus:outline-none focus:border-gray-600"
                  value={tab === 'resume' ? editedResume : editedCover}
                  onChange={e => tab === 'resume' ? setEditedResume(e.target.value) : setEditedCover(e.target.value)}
                  spellCheck={true}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
