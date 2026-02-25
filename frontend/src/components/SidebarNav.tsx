'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Video, 
  Bot, 
  Settings, 
  ScanText, 
  FileText, 
  History,
  Menu,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/live', label: 'Live Assist', icon: Video, description: 'Camera & voice' },
  { href: '/agent', label: 'AI Assistant', icon: Bot, description: 'Chat with AI' },
  { href: '/setup', label: 'Setup', icon: Settings, description: 'Configuration' },
  { href: '/ocr', label: 'OCR', icon: ScanText, description: 'Text extraction' },
  { href: '/reports', label: 'Reports', icon: FileText, description: 'View & download' },
  { href: '/history', label: 'History', icon: History, description: 'Past inspections' },
]

export function SidebarNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white/90 backdrop-blur-sm shadow-lg border border-slate-200"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40
        w-72 lg:w-64 xl:w-72 h-screen
        bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl
        border-r border-slate-200/60 dark:border-slate-800/60
        transform transition-transform duration-300 ease-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Logo */}
        <div className="p-5 lg:p-6 border-b border-slate-200/60 dark:border-slate-800/60">
          <Link href="/live" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/25 group-hover:shadow-blue-600/40 transition-shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                FieldSight
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                AI Field Assistant
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-4 space-y-1 overflow-y-auto scrollbar-thin">
          <div className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 lg:px-4 py-3 rounded-xl
                  transition-all duration-200 group
                  ${active 
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 text-blue-700 dark:text-blue-300 border-l-4 border-blue-600' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.label}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {item.description}
                  </p>
                </div>
                {active && (
                  <ChevronRight className="w-4 h-4 text-blue-400" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 lg:p-5 border-t border-slate-200/60 dark:border-slate-800/60">
          <div className="rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800/50 p-4">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Need help?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              Check docs for guides and API references.
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>v1.0.0</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System ready
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}
