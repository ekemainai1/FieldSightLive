'use client'

import { useAppStore, type Language } from '@/lib/store'
import { Globe, ChevronDown } from 'lucide-react'
import { useCallback, useState, useRef, useEffect } from 'react'

const LANGUAGES: Array<{ code: Language; name: string; flag: string }> = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
]

export function LanguageSelector() {
  const { language, setLanguage } = useAppStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]

  const handleSelect = useCallback((code: Language) => {
    setLanguage(code)
    setIsOpen(false)
  }, [setLanguage])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
        aria-label={`Language: ${currentLang.name}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        <span className="text-base">{currentLang.flag}</span>
        <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-40 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-[100]"
          role="listbox"
          aria-label="Select language"
          style={{ maxHeight: '280px' }}
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              role="option"
              aria-selected={lang.code === language}
              className={`
                w-full px-3 py-2 text-left flex items-center gap-2 transition-colors text-sm
                ${lang.code === language
                  ? 'bg-primary/10 text-primary dark:bg-primary/20'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                }
              `}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="truncate">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
