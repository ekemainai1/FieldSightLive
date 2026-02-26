'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

export type AnnotationTool = 'none' | 'arrow' | 'circle' | 'rectangle' | 'text' | 'highlight'

export interface Annotation {
  id: string
  tool: AnnotationTool
  color: string
  points: { x: number; y: number }[]
  text?: string
}

interface AROverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  annotations: Annotation[]
  onAddAnnotation: (annotation: Annotation) => void
  isActive: boolean
}

export function AROverlay({ videoRef, annotations, onAddAnnotation, isActive }: AROverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentTool, setCurrentTool] = useState<AnnotationTool>('arrow')
  const [currentColor, setCurrentColor] = useState('#ff0000')
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null)

  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000']

  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    for (const annotation of annotations) {
      drawAnnotation(ctx, annotation)
    }

    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation)
    }
  }, [videoRef, annotations, currentAnnotation])

  useEffect(() => {
    drawAnnotations()
  }, [drawAnnotations])

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.strokeStyle = annotation.color
    ctx.fillStyle = annotation.color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const points = annotation.points

    switch (annotation.tool) {
      case 'arrow':
        if (points.length >= 2) {
          const start = points[0]
          const end = points[points.length - 1]
          
          ctx.beginPath()
          ctx.moveTo(start.x, start.y)
          ctx.lineTo(end.x, end.y)
          ctx.stroke()

          const angle = Math.atan2(end.y - start.y, end.x - start.x)
          const arrowLength = 15
          
          ctx.beginPath()
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle - Math.PI / 6),
            end.y - arrowLength * Math.sin(angle - Math.PI / 6)
          )
          ctx.moveTo(end.x, end.y)
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle + Math.PI / 6),
            end.y - arrowLength * Math.sin(angle + Math.PI / 6)
          )
          ctx.stroke()
        }
        break

      case 'circle':
        if (points.length >= 2) {
          const center = points[0]
          const radius = Math.sqrt(
            Math.pow(points[points.length - 1].x - center.x, 2) +
            Math.pow(points[points.length - 1].y - center.y, 2)
          )
          ctx.beginPath()
          ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI)
          ctx.stroke()
        }
        break

      case 'rectangle':
        if (points.length >= 2) {
          const start = points[0]
          const end = points[points.length - 1]
          ctx.strokeRect(
            start.x,
            start.y,
            end.x - start.x,
            end.y - start.y
          )
        }
        break

      case 'highlight':
        if (points.length >= 2) {
          const start = points[0]
          const end = points[points.length - 1]
          ctx.globalAlpha = 0.3
          ctx.fillRect(
            start.x,
            start.y,
            end.x - start.x,
            end.y - start.y
          )
          ctx.globalAlpha = 1
        }
        break

      case 'text':
        if (points.length >= 1 && annotation.text) {
          ctx.font = '16px sans-serif'
          ctx.fillText(annotation.text, points[0].x, points[0].y)
        }
        break
    }
  }

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive || currentTool === 'none') return

    const point = getCanvasCoordinates(e)
    setIsDrawing(true)

    setCurrentAnnotation({
      id: `ann_${Date.now()}`,
      tool: currentTool,
      color: currentColor,
      points: [point],
    })
  }

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentAnnotation) return

    const point = getCanvasCoordinates(e)
    setCurrentAnnotation({
      ...currentAnnotation,
      points: [...currentAnnotation.points, point],
    })
  }

  const handleEnd = () => {
    if (!isDrawing || !currentAnnotation) return

    if (currentAnnotation.points.length > 1) {
      onAddAnnotation(currentAnnotation)
    }

    setIsDrawing(false)
    setCurrentAnnotation(null)
  }

  if (!isActive) return null

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />

      {/* Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-xl p-2">
        <button
          onClick={() => setCurrentTool('none')}
          className={`p-2 rounded-lg transition-colors ${
            currentTool === 'none' ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
          title="Select"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>

        <button
          onClick={() => setCurrentTool('arrow')}
          className={`p-2 rounded-lg transition-colors ${
            currentTool === 'arrow' ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
          title="Arrow"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </button>

        <button
          onClick={() => setCurrentTool('circle')}
          className={`p-2 rounded-lg transition-colors ${
            currentTool === 'circle' ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
          title="Circle"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          </svg>
        </button>

        <button
          onClick={() => setCurrentTool('rectangle')}
          className={`p-2 rounded-lg transition-colors ${
            currentTool === 'rectangle' ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
          title="Rectangle"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 18h16M4 6v12M20 6v12" />
          </svg>
        </button>

        <button
          onClick={() => setCurrentTool('highlight')}
          className={`p-2 rounded-lg transition-colors ${
            currentTool === 'highlight' ? 'bg-white/20' : 'hover:bg-white/10'
          }`}
          title="Highlight"
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 126 4h6m-h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-white/20 mx-1" />

        {colors.map((color) => (
          <button
            key={color}
            onClick={() => setCurrentColor(color)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${
              currentColor === color ? 'scale-125 border-white' : 'border-transparent'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}

        <div className="w-px h-6 bg-white/20 mx-1" />

        <button
          onClick={() => onAddAnnotation({
            id: `ann_${Date.now()}`,
            tool: 'text',
            color: currentColor,
            points: [{ x: 20, y: 20 }],
            text: 'Label',
          })}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Add Text"
        >
          <span className="text-white text-sm font-bold">T</span>
        </button>
      </div>
    </div>
  )
}
