'use client'

import { useLiveRegion } from '@/hooks/useAccessibility'
import { useEffect, useState } from 'react'

interface LiveRegionProps {
  message: string
  politeness?: 'polite' | 'assertive'
}

export function LiveRegion({ message, politeness = 'polite' }: LiveRegionProps) {
  const { containerRef, ...regionProps } = useLiveRegion({ politeness })
  const [lastMessage, setLastMessage] = useState(message)

  useEffect(() => {
    if (message !== lastMessage) {
      setLastMessage(message)
    }
  }, [message, lastMessage])

  return (
    <div
      ref={containerRef}
      {...regionProps}
      className="sr-only"
      role="status"
      aria-live={politeness}
      aria-atomic="true"
    >
      {lastMessage}
    </div>
  )
}

export function AlertRegion({ message }: { message: string }) {
  return <LiveRegion message={message} politeness="assertive" />
}
