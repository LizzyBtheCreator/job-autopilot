'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/queue', label: 'Review Queue' },
  { href: '/applications', label: 'Applications' },
  { href: '/interview', label: 'Interview Prep' },
  { href: '/profile', label: 'My Profile' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-gray-800 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-8 h-14">
        <span className="font-bold text-blue-400 text-lg tracking-tight">Job Autopilot</span>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium transition-colors ${
              pathname === l.href
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
