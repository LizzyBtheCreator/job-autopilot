import { supabase } from '@/lib/supabase'
import type { MasterProfile, ProfileSection, WorkHistory, Certification, Education } from '@/lib/types'

async function getData() {
  const profileRes = await supabase.from('master_profile').select('*').single()
  const pid = profileRes.data?.id
  if (!pid) return { profile: null, sections: [], work: [], certs: [], edu: [] }

  const [sectionsRes, workRes, certsRes, eduRes] = await Promise.all([
    supabase.from('profile_sections').select('*').eq('profile_id', pid).order('category'),
    supabase.from('work_history').select('*').eq('profile_id', pid).order('sort_order'),
    supabase.from('certifications').select('*').eq('profile_id', pid),
    supabase.from('education').select('*').eq('profile_id', pid),
  ])

  return {
    profile: profileRes.data as MasterProfile,
    sections: (sectionsRes.data ?? []) as ProfileSection[],
    work: (workRes.data ?? []) as WorkHistory[],
    certs: (certsRes.data ?? []) as Certification[],
    edu: (eduRes.data ?? []) as Education[],
  }
}

const categoryLabel: Record<string, string> = {
  sales: 'Sales',
  govcon: 'GovCon',
  datacenter: 'Data Center',
}

const categoryColor: Record<string, string> = {
  sales: 'border-blue-700 text-blue-400',
  govcon: 'border-purple-700 text-purple-400',
  datacenter: 'border-emerald-700 text-emerald-400',
}

export default async function ProfilePage() {
  const { profile, sections, work, certs, edu } = await getData()

  if (!profile) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg">Profile not found.</p>
        <p className="text-sm mt-2">Run the seed SQL in your Supabase dashboard to initialize your profile.</p>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name}</h1>
          <p className="text-gray-400 text-sm mt-1">{profile.location} · {profile.email} · {profile.phone}</p>
        </div>
        <div className="text-right text-sm text-gray-400 space-y-1">
          <p>Salary min: <span className="text-white font-medium">${profile.salary_min.toLocaleString()}</span></p>
          <p>Remote only: <span className="text-green-400 font-medium">Yes</span></p>
          <p>No commission-only: <span className="text-green-400 font-medium">Yes</span></p>
          <p>Daily target: <span className="text-white font-medium">{profile.is_testing_phase ? profile.daily_target : profile.daily_target_production} ({profile.is_testing_phase ? 'testing' : 'production'})</span></p>
        </div>
      </div>

      {/* Profile sections */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Job Profile Sections</h2>
        <div className="space-y-6">
          {sections.map(s => (
            <div key={s.id} className={`border rounded-xl p-5 bg-gray-900 ${categoryColor[s.category]}`}>
              <h3 className={`font-bold text-base mb-2 ${categoryColor[s.category].split(' ')[1]}`}>
                {categoryLabel[s.category]}
              </h3>
              <p className="text-gray-300 text-sm mb-4">{s.summary}</p>
              <div className="mb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Target Roles</p>
                <div className="flex flex-wrap gap-2">
                  {s.target_roles.map(r => (
                    <span key={r} className="text-xs bg-gray-800 text-gray-200 px-2 py-1 rounded">{r}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Skills & Tools</p>
                <div className="flex flex-wrap gap-2">
                  {s.skills.map(sk => (
                    <span key={sk} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">{sk}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Work history */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Work History</h2>
        <div className="space-y-4">
          {work.map(w => (
            <div key={w.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold">{w.title}</p>
                  <p className="text-gray-400 text-sm">{w.company} · {w.start_date} – {w.is_current ? 'Present' : w.end_date}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {w.categories.map(c => (
                    <span key={c} className={`text-xs px-2 py-0.5 rounded-full border ${categoryColor[c]}`}>{categoryLabel[c]}</span>
                  ))}
                  {w.is_remote && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Remote</span>}
                </div>
              </div>
              <ul className="space-y-1">
                {w.bullets.map((b, i) => (
                  <li key={i} className="text-gray-300 text-sm flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">•</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Certifications & Education */}
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-semibold mb-4">Certifications</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {certs.map(c => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  {c.issuer && <p className="text-xs text-gray-500">{c.issuer}</p>}
                </div>
                {c.in_progress && (
                  <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">In Progress</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Education</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
            {edu.map(e => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{e.institution}</p>
                  {(e.degree || e.field) && (
                    <p className="text-xs text-gray-500">{[e.degree, e.field].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                {e.in_progress && (
                  <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded-full">In Progress</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
