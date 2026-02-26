'use client'

import { useTheme } from '@/hooks/useTheme'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useCallback } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme()

  const cycleTheme = useCallback(() => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const currentIndex = order.indexOf(theme)
    const nextIndex = (currentIndex + 1) % order.length
    setTheme(order[nextIndex])
  }, [theme, setTheme])

  if (!mounted) {
    return <div className="w-10 h-10" />
  }

  const icons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  }

  const Icon = icons[theme]

  return (
    <button
      onClick={cycleTheme}
      className="btn-icon relative overflow-hidden group"
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      <Icon className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
      <span className="sr-only">Change theme</span>
    </button>
  )
}
