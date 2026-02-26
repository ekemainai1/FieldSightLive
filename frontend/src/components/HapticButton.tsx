'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { useHaptic } from '@/hooks/useHaptic'

interface HapticButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
}

export const HapticButton = forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ children, hapticType = 'light', onClick, className = '', disabled, ...props }, ref) => {
    const { vibrate, isSupported } = useHaptic()

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return
      
      if (isSupported) {
        vibrate(hapticType)
      }
      
      if (onClick) {
        onClick(e)
      }
    }

    return (
      <button
        ref={ref}
        onClick={handleClick}
        disabled={disabled}
        className={className}
        {...props}
      >
        {children}
      </button>
    )
  }
)

HapticButton.displayName = 'HapticButton'
