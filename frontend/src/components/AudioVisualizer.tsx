'use client'

import { useEffect, useRef, useState } from 'react'

interface AudioVisualizerProps {
  isActive: boolean
  audioLevel: number
  className?: string
}

export function AudioVisualizer({ isActive, audioLevel, className = '' }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const barsRef = useRef<number[]>(Array(20).fill(0))
  const [dimensions, setDimensions] = useState({ width: 120, height: 32 })

  useEffect(() => {
    const updateDimensions = () => {
      const container = document.getElementById('audio-visualizer-container')
      if (container) {
        setDimensions({
          width: container.clientWidth || 120,
          height: container.clientHeight || 32,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const { width, height } = dimensions

      ctx.clearRect(0, 0, width, height)

      const barCount = 20
      const barWidth = (width - barCount - 1) / barCount
      const gap = 1

      const targetLevel = isActive ? audioLevel / 100 : 0

      barsRef.current = barsRef.current.map((current, i) => {
        const randomFactor = Math.random() * 0.4 + 0.6
        const target = targetLevel * randomFactor
        return current + (target - current) * 0.3
      })

      const gradient = ctx.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, '#10b981')
      gradient.addColorStop(0.5, '#34d399')
      gradient.addColorStop(1, '#6ee7b7')

      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.max(4, (barsRef.current[i] / 100) * height * 0.9)
        const x = i * (barWidth + gap)
        const y = (height - barHeight) / 2

        ctx.fillStyle = isActive ? gradient : '#94a3b8'
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, 2)
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isActive, audioLevel, dimensions])

  return (
    <div id="audio-visualizer-container" className={className}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-8"
      />
    </div>
  )
}
