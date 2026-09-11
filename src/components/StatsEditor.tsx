'use client'
import { useState } from 'react'
import type { DailyStats } from '@/lib/types'

export default function StatsEditor({ today }: { today: DailyStats | null }) {
  const [open, setOpen] = useState(false)
  const [applied, setApplied] = useState(String(today?.applied ?? 0))
  const [sales, setSales] = useState(String(today?.sales_applied ?? 0))
  const [govcon, setGovcon] = useState(String(today?.govcon_applied ?? 0))
  const [datacenter, setDatacenter] = useState(String(today?.datacenter_applied ?? 0))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function save() {
    setSaving(true)
    const date = today?.date ?? new Date().toISOString().split('T')[0]
    const res = await fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        applied: parseInt(applied) || 0,
        sales_applied: parseInt(sales) || 0,
        govcon_applied: parseInt(govcon) || 0,
        datacenter_applied: parseInt(datacenter) || 0,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setMsg('Saved! Refresh the page to see updated counts.')
      setOpen(false)
    } else {
      setMsg('Error saving. Try again.')
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        {msg && <p className="text-green-400 text-xs">{msg}</p>}
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Edit counts
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Correct today&apos;s application counts</p>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300 text-xs">Cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total applied', value: applied, set: setApplied },
          { label: 'Sales', value: sales, set: setSales },
          { label: 'GovCon', value: govcon, set: setGovcon },
          { label: 'Data Center', value: datacenter, set: setDatacenter },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
            <input
              type="number"
              min="0"
              value={f.value}
              onChange={e => f.set(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="text-sm px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {msg && <p className="text-red-400 text-xs">{msg}</p>}
      </div>
    </div>
  )
}
