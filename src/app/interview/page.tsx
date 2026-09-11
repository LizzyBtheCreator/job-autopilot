'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Application, DiscoveredJob } from '@/lib/types'

type AppWithJob = Application & { job: DiscoveredJob }

interface TaxInputs {
  gross: number
  filing: 'single' | 'married' | 'hoh'
  qualifyingChildren: number
  otherDependents: number
  otherIncome: number
  deductions401k: number
  deductionsHSA: number
  itemizedDeductions: number
  extraWithholding: number
  benefits: number
}

function calcTax(inp: TaxInputs) {
  // Pre-tax reductions
  const preTax = inp.deductions401k + inp.deductionsHSA + inp.benefits * 12
  const adjustedGross = Math.max(0, inp.gross + inp.otherIncome - preTax)

  // 2024 federal standard deduction
  const stdDeduction = inp.filing === 'married' ? 29200 : inp.filing === 'hoh' ? 21900 : 14600
  const itemized = inp.itemizedDeductions > 0 ? inp.itemizedDeductions : 0
  const deduction = Math.max(stdDeduction, itemized)

  const taxable = Math.max(0, adjustedGross - deduction)

  // 2024 federal brackets
  const brackets = inp.filing === 'married'
    ? [[23200, 0.10], [94300, 0.12], [201050, 0.22], [383900, 0.24], [487450, 0.32], [731200, 0.35], [Infinity, 0.37]]
    : inp.filing === 'hoh'
    ? [[16550, 0.10], [63100, 0.12], [100500, 0.22], [191950, 0.24], [243700, 0.32], [609350, 0.35], [Infinity, 0.37]]
    : [[11600, 0.10], [47150, 0.12], [100525, 0.22], [191950, 0.24], [243725, 0.32], [609350, 0.35], [Infinity, 0.37]]

  let federal = 0
  let prev = 0
  for (const [cap, rate] of brackets) {
    if (taxable <= prev) break
    federal += (Math.min(taxable, cap as number) - prev) * (rate as number)
    prev = cap as number
  }

  // Child Tax Credit: $2,000 per qualifying child under 17, $500 per other dependent
  // Phases out above $200k single / $400k married — simplified: full credit in this range
  const childCredit = Math.min(inp.qualifyingChildren * 2000, federal)
  const otherDepCredit = Math.min(inp.otherDependents * 500, Math.max(0, federal - childCredit))
  const federalAfterCredits = Math.max(0, federal - childCredit - otherDepCredit)

  // NC flat rate 4.75% (2024) — dependents also reduce NC taxable via NC Child Deduction ($500/child)
  const ncChildDeduction = inp.qualifyingChildren * 500
  const ncTaxable = Math.max(0, adjustedGross - deduction - ncChildDeduction)
  const nc = ncTaxable * 0.0475

  // FICA on original gross (pre-tax 401k/HSA don't reduce FICA)
  const ss = Math.min(inp.gross, 168600) * 0.062
  const medicare = inp.gross * 0.0145

  // Extra withholding (annual)
  const extra = inp.extraWithholding * 26

  const totalTax = federalAfterCredits + nc + ss + medicare + extra
  const netAnnual = inp.gross + inp.otherIncome - preTax - totalTax
  const usingItemized = itemized > stdDeduction

  return { federal, childCredit, otherDepCredit, federalAfterCredits, nc, ss, medicare, extra, preTax, totalTax, netAnnual, deduction, usingItemized }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-600 mb-1">{hint}</p>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        placeholder={placeholder ?? '0'}
      />
    </div>
  )
}

function PayCalculator() {
  const [salary, setSalary] = useState('95000')
  const [filing, setFiling] = useState<'single' | 'married' | 'hoh'>('single')
  const [children, setChildren] = useState('0')
  const [otherDeps, setOtherDeps] = useState('0')
  const [otherIncome, setOtherIncome] = useState('0')
  const [k401, setK401] = useState('0')
  const [hsa, setHsa] = useState('0')
  const [itemized, setItemized] = useState('0')
  const [extraWith, setExtraWith] = useState('0')
  const [benefits, setBenefits] = useState('0')

  const n = (s: string) => parseFloat(s.replace(/,/g, '')) || 0

  const inp: TaxInputs = {
    gross: n(salary),
    filing,
    qualifyingChildren: Math.round(n(children)),
    otherDependents: Math.round(n(otherDeps)),
    otherIncome: n(otherIncome),
    deductions401k: n(k401),
    deductionsHSA: n(hsa),
    itemizedDeductions: n(itemized),
    extraWithholding: n(extraWith),
    benefits: n(benefits),
  }

  const r = useMemo(() => calcTax(inp), [JSON.stringify(inp)])

  return (
    <div className="flex-1 overflow-y-auto pr-1">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-6">

        {/* Section 1: Basic info (mirrors W-4 Step 1) */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Step 1 — Basic Info</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual Salary" value={salary} onChange={setSalary} placeholder="95000" />
            <div>
              <label className="text-xs text-gray-400 block mb-1">Filing Status</label>
              <select
                value={filing}
                onChange={e => setFiling(e.target.value as 'single' | 'married' | 'hoh')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="single">Single / Married Filing Separately</option>
                <option value="married">Married Filing Jointly</option>
                <option value="hoh">Head of Household</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Dependents (W-4 Step 3) */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Step 3 — Dependents</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qualifying children under 17" value={children} onChange={setChildren} hint="Each gives $2,000 child tax credit" placeholder="0" />
            <Field label="Other dependents" value={otherDeps} onChange={setOtherDeps} hint="Each gives $500 credit" placeholder="0" />
          </div>
        </div>

        {/* Section 3: Other adjustments (W-4 Step 4) */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Step 4 — Other Adjustments</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Other annual income (Step 4a)" value={otherIncome} onChange={setOtherIncome} hint="Side income, investments, etc." />
            <Field label="Itemized deductions (Step 4b)" value={itemized} onChange={setItemized} hint={`Standard is ${fmt(filing === 'married' ? 29200 : filing === 'hoh' ? 21900 : 14600)} — only enter if higher`} />
            <Field label="Extra withholding per paycheck (Step 4c)" value={extraWith} onChange={setExtraWith} hint="Additional $ withheld each pay period" />
          </div>
        </div>

        {/* Section 4: Pre-tax benefits */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pre-Tax Benefits (reduce taxable income)</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Health/dental/vision (monthly)" value={benefits} onChange={setBenefits} hint="Deducted from each paycheck" />
            <Field label="401k contribution (annual)" value={k401} onChange={setK401} hint="Max $23,000 in 2024" />
            <Field label="HSA contribution (annual)" value={hsa} onChange={setHsa} hint="Max $4,150 single / $8,300 family" />
          </div>
        </div>

        {/* Breakdown */}
        <div className="border-t border-gray-700 pt-4 space-y-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tax Breakdown</p>
          {[
            { label: 'Gross Annual Salary', value: fmt(inp.gross), color: 'text-white', bold: true },
            inp.otherIncome > 0 && { label: '+ Other Income', value: fmt(inp.otherIncome), color: 'text-gray-300' },
            r.preTax > 0 && { label: '- Pre-Tax Deductions (401k, HSA, benefits)', value: `-${fmt(r.preTax)}`, color: 'text-yellow-400' },
            { label: `- ${r.usingItemized ? 'Itemized' : 'Standard'} Deduction`, value: `-${fmt(r.deduction)}`, color: 'text-gray-400' },
            { label: '- Federal Income Tax', value: `-${fmt(r.federal)}`, color: 'text-red-400' },
            (r.childCredit > 0) && { label: '  + Child Tax Credit', value: `+${fmt(r.childCredit)}`, color: 'text-green-400' },
            (r.otherDepCredit > 0) && { label: '  + Other Dependent Credit', value: `+${fmt(r.otherDepCredit)}`, color: 'text-green-400' },
            { label: '- NC State Tax (4.75%)', value: `-${fmt(r.nc)}`, color: 'text-red-400' },
            { label: '- Social Security (6.2%)', value: `-${fmt(r.ss)}`, color: 'text-red-400' },
            { label: '- Medicare (1.45%)', value: `-${fmt(r.medicare)}`, color: 'text-red-400' },
            r.extra > 0 && { label: '- Extra Withholding', value: `-${fmt(r.extra)}`, color: 'text-red-400' },
          ].filter(Boolean).map((row: { label: string; value: string; color: string; bold?: boolean } | false) => row && (
            <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-800/50">
              <span className="text-sm text-gray-400">{row.label}</span>
              <span className={`text-sm font-medium ${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Take-home summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Net Annual</p>
            <p className="text-xl font-bold text-green-400">{fmt(r.netAnnual)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Net Monthly</p>
            <p className="text-xl font-bold text-green-400">{fmt(r.netAnnual / 12)}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">Net Biweekly</p>
            <p className="text-xl font-bold text-green-400">{fmt(r.netAnnual / 26)}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600">Based on 2024 federal brackets, NC 4.75% flat rate, standard deduction. Child tax credit phases out above $200k (single) / $400k (married). Actual withholding may vary — consult a tax professional for your specific situation.</p>
      </div>
    </div>
  )
}

// Parse interview date from notes field: "INTERVIEW_DATE:2026-07-28T13:00|rest of notes"
function parseInterviewDate(notes: string | null): string {
  if (!notes) return ''
  const m = notes.match(/^INTERVIEW_DATE:([^|]+)\|?/)
  return m ? m[1] : ''
}

function stripInterviewDate(notes: string | null): string {
  if (!notes) return ''
  return notes.replace(/^INTERVIEW_DATE:[^|]+\|?/, '')
}

function encodeNotes(interviewDate: string, otherNotes: string): string {
  if (!interviewDate) return otherNotes
  return `INTERVIEW_DATE:${interviewDate}|${otherNotes}`
}

function fmtInterviewTime(iso: string): { date: string; time: string; countdown: string } {
  if (!iso) return { date: '', time: '', countdown: '' }
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  let countdown = ''
  if (diffMs < 0) countdown = 'Past'
  else if (diffH < 1) countdown = 'Soon!'
  else if (diffH < 24) countdown = `In ${diffH}h`
  else if (diffD === 1) countdown = 'Tomorrow'
  else countdown = `In ${diffD} days`

  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    countdown,
  }
}

export default function InterviewPage() {
  const [apps, setApps] = useState<AppWithJob[]>([])
  const [selected, setSelected] = useState<AppWithJob | null>(null)
  const [tab, setTab] = useState<'about' | 'qa' | 'company' | 'ask' | 'cheatsheet' | 'pay'>('about')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')
  const [prep, setPrep] = useState<{
    aboutYourself: string
    questionsAnswers: string
    questionsToAsk: string
    research: string
    cheatSheet: string
  } | null>(null)
  const [interviewDates, setInterviewDates] = useState<Record<string, string>>({})
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    supabase
      .from('applications')
      .select('*, job:discovered_jobs(*)')
      .in('status', ['interviewing', 'offer', 'submitted', 'filled'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const loaded = (data ?? []) as AppWithJob[]
        setApps(loaded)
        // Pre-populate interview dates from notes
        const dates: Record<string, string> = {}
        for (const app of loaded) {
          const d = parseInterviewDate(app.notes)
          if (d) dates[app.id] = d
        }
        setInterviewDates(dates)
      })
  }, [])

  async function saveInterviewDate(appId: string, dateVal: string) {
    setSavingDate(appId)
    const app = apps.find(a => a.id === appId)
    const otherNotes = stripInterviewDate(app?.notes ?? '')
    const newNotes = encodeNotes(dateVal, otherNotes)
    await fetch('/api/applications/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appId, notes: newNotes }),
    })
    setApps(prev => prev.map(a => a.id === appId ? { ...a, notes: newNotes } : a))
    setSavingDate(null)
  }

  // Load existing prep when selecting an app — only clears if switching to a different app
  useEffect(() => {
    if (!selected) return
    setPrep(null)
    supabase
      .from('interview_prep')
      .select('*')
      .eq('application_id', selected.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrep({
            aboutYourself: data.about_yourself ?? '',
            questionsAnswers: data.questions_answers ?? '',
            questionsToAsk: data.questions_to_ask ?? '',
            research: data.company_research ?? '',
            cheatSheet: data.cheat_sheet ?? '',
          })
        }
      })
  }, [selected?.id])

  async function generate() {
    if (!selected) return
    setGenerating(true)
    setMsg('Researching company and generating your prep... this takes about 30 seconds.')
    try {
      const res = await fetch('/api/interview/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: selected.id,
          company: selected.job?.company,
          role: selected.job?.title,
          jobDescription: selected.job?.description,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPrep(data)
        setMsg('')
        setTab('about')
      } else {
        setMsg('Generation failed. Check your API credits and try again.')
      }
    } catch {
      setMsg('Something went wrong. Try again.')
    }
    setGenerating(false)
  }

  function download() {
    if (!prep?.cheatSheet) return
    const filename = `InterviewPrep_${selected?.job?.company ?? 'Interview'}.txt`
    const blob = new Blob([prep.cheatSheet], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text)
    setMsg('Copied!')
    setTimeout(() => setMsg(''), 2000)
  }

  const tabs = [
    { key: 'about', label: 'Tell Me About Yourself' },
    { key: 'qa', label: 'Q&A' },
    { key: 'company', label: 'Company Research' },
    { key: 'ask', label: 'Ask Them' },
    { key: 'cheatsheet', label: 'Cheat Sheet' },
    { key: 'pay', label: 'Pay Calculator' },
  ] as const

  // Sort: interviewing with dates first (chronological), then by status, then rest
  const sortedApps = [...apps].sort((a, b) => {
    const da = interviewDates[a.id] ?? ''
    const db = interviewDates[b.id] ?? ''
    if (da && db) return new Date(da).getTime() - new Date(db).getTime()
    if (da) return -1
    if (db) return 1
    return 0
  })

  const visibleApps = showAll ? sortedApps : sortedApps.filter(a => a.status === 'interviewing' || a.status === 'offer')

  const scheduledCount = sortedApps.filter(a => interviewDates[a.id]).length

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left panel — application list */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
        <div>
          <h1 className="text-xl font-bold">Interviews</h1>
          <p className="text-gray-500 text-xs mt-1">{scheduledCount} scheduled · {apps.filter(a => a.status === 'interviewing').length} active</p>
        </div>

        <button
          onClick={() => setShowAll(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex-shrink-0 ${
            showAll ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          {showAll ? 'Showing all statuses' : 'Interviewing & offers only'}
        </button>

        <div className="flex-1 overflow-y-auto space-y-2">
          {visibleApps.length === 0 ? (
            <p className="text-gray-500 text-sm">No active interviews. Mark applications as &quot;interviewing&quot; in the Applications tab to see them here.</p>
          ) : (
            visibleApps.map(app => {
              const dateVal = interviewDates[app.id] ?? ''
              const fmt = dateVal ? fmtInterviewTime(dateVal) : null
              const isPast = fmt && fmt.countdown === 'Past'
              return (
                <div key={app.id} className={`rounded-xl border transition-colors ${
                  selected?.id === app.id ? 'border-blue-600 bg-gray-800' : 'border-gray-800 bg-gray-900'
                }`}>
                  <button
                    onClick={() => { setSelected(app); setMsg('') }}
                    className="w-full text-left p-3"
                  >
                    <p className="font-medium text-sm truncate">{app.job?.title}</p>
                    <p className="text-gray-400 text-xs truncate">{app.job?.company}</p>
                    {fmt ? (
                      <div className={`mt-1.5 flex items-center gap-2 ${isPast ? 'opacity-50' : ''}`}>
                        <span className="text-xs text-white font-medium">{fmt.date} · {fmt.time}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          isPast ? 'bg-gray-700 text-gray-400' :
                          fmt.countdown === 'Soon!' ? 'bg-red-900 text-red-300 animate-pulse' :
                          fmt.countdown === 'Tomorrow' ? 'bg-yellow-900 text-yellow-300' :
                          'bg-purple-900 text-purple-300'
                        }`}>{fmt.countdown}</span>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">No date set</p>
                    )}
                    <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${
                      app.status === 'interviewing' ? 'bg-purple-900/60 text-purple-300' :
                      app.status === 'offer' ? 'bg-emerald-900 text-emerald-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>{app.status}</span>
                  </button>

                  {/* Date/time input inline */}
                  <div className="px-3 pb-3 flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={dateVal}
                      onChange={e => setInterviewDates(prev => ({ ...prev, [app.id]: e.target.value }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => saveInterviewDate(app.id, interviewDates[app.id] ?? '')}
                      disabled={savingDate === app.id}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-800 hover:bg-blue-700 text-blue-200 font-medium disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {savingDate === app.id ? '...' : 'Save'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <p>Select an application to generate interview prep</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between mb-3 flex-shrink-0 gap-4">
              <div>
                <h2 className="text-lg font-bold">{selected.job?.title}</h2>
                <p className="text-gray-400 text-sm">{selected.job?.company}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                {msg && <p className="text-xs text-blue-400 text-right max-w-[280px]">{msg}</p>}
                <div className="flex gap-2">
                  {prep && (
                    <button
                      onClick={download}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                    >
                      Download Cheat Sheet
                    </button>
                  )}
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-medium disabled:opacity-50 transition-colors"
                  >
                    {generating ? 'Generating...' : prep ? 'Regenerate' : 'Generate Prep'}
                  </button>
                </div>
              </div>
            </div>

            {!prep && !generating ? (
              tab === 'pay' ? (
                <div className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0">
                  <PayCalculator />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-600 flex-col gap-3">
                  <p>No prep generated yet.</p>
                  <button
                    onClick={generate}
                    className="text-sm px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-medium transition-colors"
                  >
                    Generate Interview Prep
                  </button>
                  <button onClick={() => setTab('pay')} className="text-xs text-gray-500 hover:text-gray-300 underline">
                    Or open Pay Calculator
                  </button>
                </div>
              )
            ) : generating ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Researching {selected.job?.company} and crafting your answers...</p>
              </div>
            ) : prep ? (
              <>
                {/* Tabs */}
                <div className="flex gap-2 mb-3 flex-shrink-0 flex-wrap">
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        tab === t.key ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0">
                  {tab === 'pay' ? (
                    <PayCalculator />
                  ) : (
                    <>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => copy(
                            tab === 'about' ? prep.aboutYourself :
                            tab === 'qa' ? prep.questionsAnswers :
                            tab === 'company' ? prep.research :
                            tab === 'ask' ? prep.questionsToAsk :
                            prep.cheatSheet
                          )}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                        >
                          Copy
                        </button>
                        {tab === 'cheatsheet' && (
                          <button
                            onClick={download}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                          >
                            Download .txt
                          </button>
                        )}
                      </div>
                      <textarea
                        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-200 font-sans leading-relaxed resize-none focus:outline-none focus:border-gray-600"
                        value={
                          tab === 'about' ? prep.aboutYourself :
                          tab === 'qa' ? prep.questionsAnswers :
                          tab === 'company' ? prep.research :
                          tab === 'ask' ? prep.questionsToAsk :
                          prep.cheatSheet
                        }
                        onChange={e => {
                          const val = e.target.value
                          setPrep(p => p ? {
                            ...p,
                            aboutYourself: tab === 'about' ? val : p.aboutYourself,
                            questionsAnswers: tab === 'qa' ? val : p.questionsAnswers,
                            research: tab === 'company' ? val : p.research,
                            questionsToAsk: tab === 'ask' ? val : p.questionsToAsk,
                            cheatSheet: tab === 'cheatsheet' ? val : p.cheatSheet,
                          } : p)
                        }}
                        spellCheck={true}
                      />
                    </>
                  )}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
