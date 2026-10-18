'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Job {
  id: string
  title: string
  company: string
  url: string
  description: string | null
  fit_score: number
  fit_notes: string | null
  salary_raw: string | null
  is_remote: boolean | null
  role_type: string | null
  status: string
  discovered_at: string
}

const scoreColor = (s: number) =>
  s >= 85 ? 'text-green-400' : s >= 70 ? 'text-yellow-400' : 'text-orange-400'

const categoryLabel: Record<string, string> = {
  proposals:    'Proposals',
  contracts:    'Contracts',
  compliance:   'Compliance',
  grants:       'Grants',
  program_ops:  'Program Ops',
  govcon_public:'Gov / Public Sector',
  business_dev: 'Business Dev',
  consulting:   'Consulting',
  govcon:       'GovCon',
  sales:        'Sales',
}

export default function QueuePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState<Record<string, string>>({})
  const [rejecting, setRejecting] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('discovered_jobs')
      .select('*')
      .eq('status', 'new')
      .order('fit_score', { ascending: false })
      .limit(200)
    setJobs((data ?? []) as Job[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function generateResume(job: Job) {
    setGenerating(job.id)
    setGenStatus(prev => ({ ...prev, [job.id]: 'Generating resume…' }))
    try {
      const res = await fetch('/api/applications/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = await res.json()
      if (data.success) {
        setGenStatus(prev => ({ ...prev, [job.id]: 'Resume ready — check Applications tab' }))
        // Remove from queue display after short delay
        setTimeout(() => {
          setJobs(prev => prev.filter(j => j.id !== job.id))
        }, 2000)
      } else {
        setGenStatus(prev => ({ ...prev, [job.id]: `Error: ${data.error}` }))
      }
    } catch {
      setGenStatus(prev => ({ ...prev, [job.id]: 'Network error — try again' }))
    } finally {
      setGenerating(null)
    }
  }

  async function rejectJob(id: string) {
    setRejecting(id)
    const { error } = await supabase
      .from('discovered_jobs')
      .update({ status: 'rejected' })
      .eq('id', id)
    if (!error) {
      setJobs(prev => prev.filter(j => j.id !== id))
    }
    setRejecting(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-6">
        <span className="font-semibold text-white">Job Autopilot</span>
        <Link href="/" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
        <Link href="/queue" className="text-sm text-indigo-400 font-medium">Queue</Link>
        <Link href="/applications" className="text-sm text-gray-400 hover:text-white">Applications</Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Job Queue</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {loading ? 'Loading…' : `${jobs.length} jobs waiting — sorted by fit score`}
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Run new search →
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-12 text-center">Loading queue…</p>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">Queue is empty.</p>
            <Link href="/" className="text-indigo-400 text-sm mt-2 inline-block hover:text-indigo-300">
              Go search for jobs →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-white hover:text-indigo-300 truncate"
                      >
                        {job.title}
                      </a>
                      {job.is_remote && (
                        <span className="text-xs bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded-full flex-shrink-0">
                          Remote
                        </span>
                      )}
                    </div>

                    {/* Company + category */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-400">{job.company}</span>
                      {job.role_type && categoryLabel[job.role_type] && (
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                          {categoryLabel[job.role_type]}
                        </span>
                      )}
                      {job.salary_raw && (
                        <span className="text-xs text-green-400">{job.salary_raw}</span>
                      )}
                    </div>

                    {/* Description snippet */}
                    {job.description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>
                    )}

                    {/* Status message */}
                    {genStatus[job.id] && (
                      <p className={`text-xs mt-2 ${genStatus[job.id].startsWith('Error') ? 'text-red-400' : 'text-indigo-300'}`}>
                        {genStatus[job.id]}
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <span className={`text-2xl font-bold ${scoreColor(job.fit_score)}`}>
                      {job.fit_score}
                    </span>
                    <p className="text-xs text-gray-600 mt-0.5">fit score</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => generateResume(job)}
                    disabled={generating === job.id || !!genStatus[job.id]?.includes('ready')}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    {generating === job.id ? 'Generating…' : 'Generate Resume'}
                  </button>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm text-gray-300 border border-gray-700 rounded-lg hover:border-gray-500 hover:text-white transition-colors"
                  >
                    View Job
                  </a>
                  <button
                    onClick={() => rejectJob(job.id)}
                    disabled={rejecting === job.id}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-red-400 transition-colors"
                  >
                    {rejecting === job.id ? '…' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
