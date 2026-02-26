'use client'

import { useAppStore, type Language } from '@/lib/store'
import { getTranslations, type Translation } from '@/lib/translations'
import { useEffect, useState } from 'react'

export function useTranslation(): Translation {
  const language = useAppStore((state) => state.language)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('fieldsightlive.language') as Language | null
    if (stored && ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi'].includes(stored)) {
      useAppStore.getState().setLanguage(stored)
    }
  }, [])

  if (!mounted) {
    return getTranslations('en')
  }

  return getTranslations(language)
}

export function useCurrentLanguage(): Language {
  return useAppStore((state) => state.language)
}
