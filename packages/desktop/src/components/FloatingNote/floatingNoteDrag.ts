import type { FloatingNote as FN } from '../../types'

export function handleMouseDown(
  e: React.MouseEvent,
  note: FN,
  standalone: boolean | undefined,
  pos: { x: number; y: number },
  focusNote: (id: string) => void,
  moveNote: (id: string, x: number, y: number) => void,
  setDragging: (v: boolean) => void,
  setPos: (pos: { x: number; y: number }) => void,
  cleanupDragRef: React.MutableRefObject<(() => void) | null>,
) {
  if (standalone) return
  if (note.locked) return
  if (note.archived) return
  if ((e.target as HTMLElement).closest('.no-drag')) return
  if (e.button === 2) return
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'A') return
  if ((e.target as HTMLElement).closest('button')) return
  focusNote(note.id)
  const dragRef = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
  setDragging(true)

  const onMove = (ev: MouseEvent) => {
    const nx = dragRef.origX + ev.clientX - dragRef.startX
    const ny = dragRef.origY + ev.clientY - dragRef.startY
    setPos({ x: nx, y: ny })
  }
  const onUp = (ev: MouseEvent) => {
    setDragging(false)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    cleanupDragRef.current = null
    const fx = dragRef.origX + ev.clientX - dragRef.startX
    const fy = dragRef.origY + ev.clientY - dragRef.startY
    moveNote(note.id, fx, fy)
  }
  cleanupDragRef.current = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

export function handleResizeStart(
  e: React.MouseEvent,
  note: FN,
  standalone: boolean | undefined,
  updateFloatingNote: (id: string, data: Partial<FN>) => void,
  cleanupDragRef: React.MutableRefObject<(() => void) | null>,
) {
  if (standalone) return
  if (note.locked || note.archived) return
  e.stopPropagation()
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const startW = note.width
  const startH = note.height

  let rafId: number | null = null
  const onMove = (ev: MouseEvent) => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      rafId = null
      updateFloatingNote(note.id, {
        width: Math.max(180, (startW || 280) + ev.clientX - startX),
        height: Math.max(100, (startH || 200) + ev.clientY - startY),
      })
    })
  }
  const onUp = () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    cleanupDragRef.current = null
  }
  cleanupDragRef.current = () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
