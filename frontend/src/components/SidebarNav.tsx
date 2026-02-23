'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/live', label: 'Live Assist' },
  { href: '/setup', label: 'Setup' },
  { href: '/ocr', label: 'OCR' },
  { href: '/reports', label: 'Reports' },
  { href: '/history', label: 'History' },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-64 md:min-h-screen border-r bg-card">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold">FieldSight Live</h1>
        <p className="text-xs text-muted-foreground">Technician Workspace</p>
      </div>
      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm ${
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
