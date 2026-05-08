import React, { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import CategoryPills from '../Sidebar/CategoryPills'
import TodoList from '../Todo/TodoList'
import Toolbar from '../Common/Toolbar'
import { COLOR_PRESETS, hexToRgb } from '../../utils/helpers'
import TrashPanel from '../Common/TrashPanel'

const ei = (window as any).electronAPI
const isElectron = !!ei

const nd = isElectron ? ({ WebkitAppRegion: 'no-drag' as any } as React.CSSProperties) : undefined

const AcrylicPanel: React.FC = () => {
  const { panel, setPanelPos, togglePanelPin, togglePanelLock, setPanelOpacity, setPanelColor, theme, toggleTheme, viewMode } = useStore()
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [showPanelOpacity, setShowPanelOpacity] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 })
  const resizeRef = useRef({ startX: 0, startW: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isElectron || panel.locked) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: panel.x, origY: panel.y }
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      const nx = dragRef.current.origX + ev.clientX - dragRef.current.startX
      const ny = Math.max(0, dragRef.current.origY + ev.clientY - dragRef.current.startY)
      setPanelPos(nx, ny)
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Window width resize handle (Electron only)
  const handleResizeStart = (e: React.MouseEvent) => {
    if (!isElectron || panel.locked) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = { startX: e.clientX, startW: window.innerWidth }

    const onMove = (ev: MouseEvent) => {
      const dw = ev.clientX - resizeRef.current.startX
      const newW = Math.max(280, resizeRef.current.startW + dw)
      ei.resizeWindow(newW, window.innerHeight)
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    setResizing(true)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Resize Electron window when entering/leaving kanban mode
  useEffect(() => {
    if (!isElectron) return
    const w = viewMode === 'board' ? 700 : 380
    const h = window.innerHeight
    ei.resizeWindow(w, h)
  }, [viewMode])

  // Lock: disable OS window resize when locked (Electron only)
  useEffect(() => {
    if (!isElectron) return
    ei.setResizable(!panel.locked)
  }, [panel.locked])

  const panelZ = 99999 // fixed high, never buried by notes

  // Transparency: background alpha instead of container opacity
  // Lower base alpha in Electron (acrylic shows through), higher in browser
  const baseAlpha = isElectron ? 0.65 : 0.72
  const bgAlpha = baseAlpha * panel.opacity
  let bgColor: string
  if (panel.color) {
    const rgb = hexToRgb(panel.color)
    if (rgb) {
      const tint = 0.30 * panel.opacity
      const r = Math.round(22 + (rgb.r - 22) * tint)
      const g = Math.round(22 + (rgb.g - 22) * tint)
      const b = Math.round(32 + (rgb.b - 32) * tint)
      bgColor = `rgba(${r},${g},${b},${bgAlpha.toFixed(2)})`
    } else {
      bgColor = `rgba(22,22,32,${bgAlpha.toFixed(2)})`
    }
  } else {
    bgColor = `rgba(22,22,32,${bgAlpha.toFixed(2)})`
  }

  return (
    <motion.div
      initial={{ opacity: 0.3, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed z-20 overflow-hidden flex flex-col fluent-shadow-lg ${isElectron ? '' : 'rounded-2xl'}`}
      style={{
        left: isElectron ? 0 : panel.x,
        top: isElectron ? 0 : panel.y,
        right: isElectron ? 0 : undefined,
        width: isElectron ? '100%' : (viewMode === 'board' ? 700 : 340),
        maxWidth: isElectron ? (viewMode === 'board' ? 'min(85vw, 800px)' : 'min(85vw, 560px)') : undefined,
        height: isElectron ? '100vh' : 'calc(100vh - 32px)',
        margin: isElectron ? '0 auto' : undefined,
        zIndex: panelZ,
        background: bgColor,
        backdropFilter: isElectron ? 'none' : 'blur(20px) saturate(1.3)',
        border: panel.color ? `1px solid ${panel.color}40` : '1px solid rgba(255,255,255,0.05)',
        boxShadow: panel.color ? `0 8px 40px rgba(0,0,0,0.35), 0 0 30px ${panel.color}12` : undefined,
        borderRadius: isElectron ? 0 : undefined,
        cursor: isElectron ? 'default' : (panel.locked ? 'default' : dragging ? 'grabbing' : 'default'),
      }}
    >
      {/* Header with drag + window controls */}
      <div
        className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.04]"
        onMouseDown={handleMouseDown}
        style={isElectron ? ({ WebkitAppRegion: 'drag' as any, cursor: 'default' } as React.CSSProperties) : {
          cursor: panel.locked ? 'default' : dragging ? 'grabbing' : 'grab',
        }}
      >
        <div className="flex items-center gap-2" style={nd}>
          <button onClick={toggleTheme}
            className="w-5 h-5 flex items-center justify-center rounded-lg transition-all text-[10px] text-white/65 hover:text-white/72 hover:bg-white/[0.06]"
            title="切换主题">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-moon' : 'fa-sun'}`} />
          </button>
          <span className="text-xs font-medium tracking-wide" style={{ color: 'var(--text-primary)' }}>便签</span>
        </div>
        <div className="flex items-center gap-1" style={nd}>
          <button onClick={() => setShowTrash(true)}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-white/65 hover:text-white/72 hover:bg-white/[0.06] transition-all text-[10px]"
            title="回收站">
            <i className="fa-regular fa-trash-can" />
          </button>
          <button onClick={() => {
            const next = !panel.pinned
            togglePanelPin()
            if (isElectron) ei.alwaysOnTop(next)
          }}
            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all text-[10px] ${panel.pinned ? 'text-fluent-blue/60' : 'text-white/65 hover:text-white/72 hover:bg-white/[0.06]'}`}
            style={panel.locked ? ({ pointerEvents: 'auto', position: 'relative', zIndex: 1001 } as React.CSSProperties) : undefined}
            title={panel.pinned ? '取消置顶' : '置顶'}>
            <i className="fa-solid fa-thumbtack" />
          </button>
          <button onClick={togglePanelLock}
            className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all text-[10px] ${panel.locked ? 'text-amber-400/60' : 'text-white/65 hover:text-white/72 hover:bg-white/[0.06]'}`}
            style={panel.locked ? ({ pointerEvents: 'auto', position: 'relative', zIndex: 1000 } as React.CSSProperties) : undefined}
            title={panel.locked ? '点击取消固定' : '固定'}>
            <i className="fa-solid fa-lock" />
          </button>
          <div className="relative">
            <button onClick={() => setShowPanelOpacity(!showPanelOpacity)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-white/65 hover:text-white/72 hover:bg-white/[0.06] transition-all text-[10px]"
              title="透明度">
              <i className="fa-solid fa-circle-half-stroke" />
            </button>
            {showPanelOpacity && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-[rgba(18,18,28,0.96)] border border-white/[0.08] rounded-xl px-3 py-2 shadow-xl flex flex-col gap-2 min-w-[180px]"
                onMouseDown={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/72 w-7">透明</span>
                  <input type="range" min="0.15" max="1" step="0.05"
                    value={panel.opacity}
                    onChange={e => setPanelOpacity(parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-fluent-blue cursor-pointer"
                  />
                  <span className="text-[10px] text-white/80 w-5 text-right">{Math.round(panel.opacity * 100)}%</span>
                </div>
                <div className="border-t border-white/[0.06] pt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] text-white/72">颜色</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_PRESETS.map(p => (
                      <button key={p.name}
                        onClick={() => setPanelColor(p.color || undefined)}
                        className="w-4 h-4 rounded-full border border-white/[0.15] flex items-center justify-center transition-transform hover:scale-125"
                        style={{ background: p.color || 'transparent' }}
                        title={p.name}>
                        {!p.color ? <span className="w-2 h-0.5 bg-white/30 rounded-full" /> : null}
                        {panel.color === p.color && <i className="fa-solid fa-check text-[6px] text-white/90" />}
                      </button>
                    ))}
                    <label className="w-4 h-4 rounded-full border border-dashed border-white/[0.25] flex items-center justify-center cursor-pointer hover:border-white/50 transition-colors"
                      title="自定义颜色">
                      <i className="fa-solid fa-plus text-[7px] text-white/50" />
                      <input type="color" value={panel.color || '#3b82f6'}
                        onChange={e => setPanelColor(e.target.value)}
                        className="absolute opacity-0 w-0 h-0" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
          {isElectron && (
            <>
              <button style={nd} onClick={() => ei.minimize()}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/65 hover:text-white/72 hover:bg-white/[0.06] transition-all text-[10px]">
                <i className="fa-regular fa-window-minimize" />
              </button>
              <button style={nd} onClick={() => ei.close()}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-white/65 hover:text-red-400/60 hover:bg-white/[0.06] transition-all text-[10px]">
                <i className="fa-solid fa-xmark" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dormant notes list (Electron only — notes without an OS window) */}
      {isElectron && <DormantNoteList />}

      {/* Content: categories + todo — disabled when locked */}
      <div className="flex flex-1 min-h-0" style={{ ...nd, pointerEvents: panel.locked ? 'none' as const : undefined }}>
        {viewMode !== 'board' && <CategoryPills />}
        <div className="flex-1 flex flex-col min-h-0">
          <TodoList />
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={nd}><Toolbar /></div>

      {/* Lock overlay — events pass through, actual blocking via content pointer-events */}
      {panel.locked && (
        <div className="absolute inset-0 z-[997]" style={{ background: 'transparent', pointerEvents: 'none' as React.CSSProperties['pointerEvents'] }} />
      )}

      {/* Window width resize handle (Electron only) */}
      {isElectron && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-50 group"
        >
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-full transition-all ${resizing ? 'bg-white/30' : 'bg-white/0 group-hover:bg-white/20'}`} />
        </div>
      )}
      {/* Trash panel modal */}
      <AnimatePresence>
        {showTrash && <TrashPanel onClose={() => setShowTrash(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}

/** Electron only: list of non-floated notes that can be reopened */
const DormantNoteList: React.FC = () => {
  const floatingNotes = useStore(s => s.floatingNotes)
  const updateFloatingNote = useStore(s => s.updateFloatingNote)
  const [expanded, setExpanded] = useState(false)

  const dormant = floatingNotes.filter(n => !n.floated)

  if (dormant.length === 0) return null

  const openNote = (n: typeof dormant[0]) => {
    updateFloatingNote(n.id, { floated: true })
    const ei = (window as any).electronAPI
    if (ei) {
      ei.createFloatingWindow({
        id: n.id, screenX: n.x, screenY: n.y,
        width: n.width, height: n.height,
      })
    }
  }

  return (
    <div className="border-b border-white/[0.04]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[9px] text-white/40 hover:text-white/60 hover:bg-white/[0.03] transition-colors"
      >
        <i className={`fa-solid fa-chevron-right text-[7px] transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <i className="fa-regular fa-note-sticky text-[8px]" />
        便签 ({dormant.length})
      </button>
      {expanded && (
        <div className="px-2 pb-1.5 space-y-0.5 max-h-[120px] overflow-y-auto">
          {dormant.map(n => (
            <button
              key={n.id}
              onClick={() => openNote(n)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] text-white/60 hover:text-white/80 hover:bg-white/[0.04] transition-colors text-left truncate"
              title={`点击打开: ${n.title}`}
            >
              <i className="fa-regular fa-window-restore text-[7px] text-white/30 flex-shrink-0" />
              <span className="truncate">{n.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AcrylicPanel
