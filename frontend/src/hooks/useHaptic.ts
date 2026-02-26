'use client'

import { useCallback } from 'react'

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'

const HAPTIC_MAP: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [0, 10, 10, 20],
  warning: [0, 20, 10, 20],
  error: [0, 30, 20, 30],
  selection: 5,
}

export function useHaptic() {
  const vibrate = useCallback((type: HapticType = 'light') => {
    if (typeof window === 'undefined' || !navigator.vibrate) return

    const value = HAPTIC_MAP[type]
    navigator.vibrate(value)
  }, [])

  const hapticLight = useCallback(() => vibrate('light'), [vibrate])
  const hapticMedium = useCallback(() => vibrate('medium'), [vibrate])
  const hapticHeavy = useCallback(() => vibrate('heavy'), [vibrate])
  const hapticSuccess = useCallback(() => vibrate('success'), [vibrate])
  const hapticWarning = useCallback(() => vibrate('warning'), [vibrate])
  const hapticError = useCallback(() => vibrate('error'), [vibrate])
  const hapticSelection = useCallback(() => vibrate('selection'), [vibrate])

  return {
    vibrate,
    hapticLight,
    hapticMedium,
    hapticHeavy,
    hapticSuccess,
    hapticWarning,
    hapticError,
    hapticSelection,
    isSupported: typeof navigator !== 'undefined' && 'vibrate' in navigator,
  }
}
