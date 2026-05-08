import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { uid } from '../../utils/helpers'
import FloatingNoteComp from './FloatingNote'

const CanvasMode: React.FC = () => {
  const {
    floatingNotes, canvas, setCanvas, addFloatingNote, nextZ,
    noteSearchQuery, setNoteSearchQuery,
  } = useStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 })

  // Filter notes
  const visibleNotes = floatingNotes.filter(n => !n.archived)

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.25, Math.min(4, canvas.zoom * delta))

    // Zoom toward cursor position
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const scale = newZoom / canvas.zoom
      setCanvas({
        zoom: newZoom,
        offsetX: mx - (mx - canvas.offsetX) * scale,
        offsetY: my - (my - canvas.offsetY) * scale,
      })
    } else {
      setCanvas({ zoom: newZoom })
    }
  }, [canvas.zoom, canvas.offsetX, canvas.offsetY, setCanvas])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan when clicking the canvas background (not on notes)
    const target = e.target as HTMLElement
    if (target.closest('[data-note]')) return

    panRef.current = { startX: e.clientX, startY: e.clientY, origX: canvas.offsetX, origY: canvas.offsetY }
    setIsPanning(true)

    const onMove = (ev: MouseEvent) => {
      setCanvas({
        offsetX: panRef.current.origX + (ev.clientX - panRef.current.startX),
        offsetY: panRef.current.origY + (ev.clientY - panRef.current.startY),
      })
    }
    const onUp = () => {
      setIsPanning(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [canvas.offsetX, canvas.offsetY, setCanvas])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-note]')) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left - canvas.offsetX) / canvas.zoom - 130
    const y = (e.clientY - rect.top - canvas.offsetY) / canvas.zoom - 100

    const id = uid()
    addFloatingNote({
      id, type: 'text', title: '📝 新便签', content: '',
      x, y, width: 260, height: 200, zIndex: nextZ,
    })
  }, [canvas.offsetX, canvas.offsetY, canvas.zoom, addFloatingNote, nextZ])

  // Generate adaptive grid dots
  const gridSize = Math.max(20, Math.round(40 * canvas.zoom))
  const gridOpacity = Math.min(0.5, Math.max(0.1, canvas.zoom * 0.15))

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <div className="w-[200px] flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.04] focus-within:border-white/[0.1] transition-colors backdrop-blur-lg">
          <span className="text-white/60 text-xs"><i className="fa-solid fa-magnifying-glass" /></span>
          <input
            value={noteSearchQuery}
            onChange={e => setNoteSearchQuery(e.target.value)}
            placeholder="搜索便签..."
            className="flex-1 bg-transparent text-xs text-white/92 placeholder:text-white/60 outline-none"
          />
        </div>
      </div>

      {/* Canvas surface */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* Grid background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ opacity: gridOpacity }}
        >
          <defs>
            <pattern
              id="canvas-grid"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${canvas.offsetX % gridSize}, ${canvas.offsetY % gridSize})`}
            >
              <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.3)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#canvas-grid)" />
        </svg>

        {/* Notes */}
        <div
          style={{
            transform: `translate(${canvas.offsetX}px, ${canvas.offsetY}px) scale(${canvas.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {visibleNotes.map(n => (
            <div key={n.id} data-note>
              <FloatingNoteComp note={n} />
            </div>
          ))}
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 z-20 bg-[rgba(18,18,28,0.85)] border border-white/[0.08] rounded-lg px-2.5 py-1 shadow-xl">
        <span className="text-[10px] text-white/60">{Math.round(canvas.zoom * 100)}%</span>
      </div>
    </div>
  )
}

export default CanvasMode
