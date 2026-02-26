'use client'

import { useCallback, useRef, useEffect } from 'react'

interface UseLiveRegionOptions {
  politeness?: 'polite' | 'assertive'
  timeout?: number
}

export function useLiveRegion(options: UseLiveRegionOptions = {}) {
  const { politeness = 'polite', timeout = 5000 } = options
  const containerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const announce = useCallback((message: string) => {
    if (!containerRef.current) return

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    containerRef.current.textContent = ''
    
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.textContent = message
      }
    })

    timeoutRef.current = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.textContent = ''
      }
    }, timeout)
  }, [timeout])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    containerRef,
    announce,
    role: 'status' as const,
    'aria-live': politeness,
    'aria-atomic': 'true',
  }
}

export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean; preventDefault?: boolean } = {}
) {
  const { ctrl = false, shift = false, alt = false, preventDefault = true } = options

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase()
      const matchesCtrl = ctrl ? (event.ctrlKey || event.metaKey) : true
      const matchesShift = shift ? event.shiftKey : true
      const matchesAlt = alt ? event.altKey : true

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
        if (preventDefault) {
          event.preventDefault()
        }
        callback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, callback, ctrl, shift, alt, preventDefault])
}

export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)
    firstElement?.focus()

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }, [isActive, containerRef])
}
