import { useCallback, useEffect, useRef, useState } from 'react'
import { pickXiaoWenLine, type XiaoWenAction } from './xiaowenDialogue'

interface XiaoWenPetState {
  action: XiaoWenAction
  line: string
  dragging: boolean
  triggerAction: (action: XiaoWenAction, durationMs?: number) => void
  handleClick: () => void
  handleDoubleClick: () => void
  handleDragStart: () => void
  handleDragEnd: () => void
}

const ACTION_DURATION: Partial<Record<XiaoWenAction, number>> = {
  clickDefend: 1200,
  shy: 1800,
  land: 1300,
  combo3: 1800,
  combo5: 2600,
  chatOpen: 2400,
  notice: 1800,
  sleepy: 2600,
  startup: 2200,
}

const IDLE_LINE_MIN_MS = 18000
const IDLE_LINE_MAX_MS = 42000

export function useXiaoWenPetState(): XiaoWenPetState {
  const [action, setAction] = useState<XiaoWenAction>('startup')
  const [line, setLine] = useState(() => pickXiaoWenLine('startup'))
  const [dragging, setDragging] = useState(false)
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const comboCountRef = useRef(0)
  const comboResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current) {
      clearTimeout(actionTimerRef.current)
      actionTimerRef.current = null
    }
  }, [])

  const triggerAction = useCallback((nextAction: XiaoWenAction, durationMs?: number) => {
    clearActionTimer()
    setAction(nextAction)
    setLine(pickXiaoWenLine(nextAction))

    const duration = durationMs ?? ACTION_DURATION[nextAction]
    if (duration) {
      actionTimerRef.current = setTimeout(() => {
        setAction('idle')
      }, duration)
    }
  }, [clearActionTimer])

  useEffect(() => {
    triggerAction('startup')
    return () => {
      clearActionTimer()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (comboResetRef.current) clearTimeout(comboResetRef.current)
    }
  }, [clearActionTimer, triggerAction])

  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (action !== 'idle' || dragging) return

    const delay = IDLE_LINE_MIN_MS + Math.random() * (IDLE_LINE_MAX_MS - IDLE_LINE_MIN_MS)
    idleTimerRef.current = setTimeout(() => {
      setLine(pickXiaoWenLine('idle'))
    }, delay)

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [action, dragging, line])

  const handleClick = useCallback(() => {
    if (dragging) return
    comboCountRef.current += 1
    if (comboResetRef.current) clearTimeout(comboResetRef.current)

    if (comboCountRef.current >= 5) {
      comboCountRef.current = 0
      triggerAction('combo5')
      return
    }

    if (comboCountRef.current >= 3) {
      triggerAction('combo3')
    } else {
      triggerAction('clickDefend')
    }

    comboResetRef.current = setTimeout(() => {
      comboCountRef.current = 0
    }, 900)
  }, [dragging, triggerAction])

  const handleDoubleClick = useCallback(() => {
    if (dragging) return
    comboCountRef.current = 0
    triggerAction('shy')
  }, [dragging, triggerAction])

  const handleDragStart = useCallback(() => {
    setDragging(true)
    comboCountRef.current = 0
    clearActionTimer()
    setAction('dragFly')
    setLine(pickXiaoWenLine('dragFly'))
  }, [clearActionTimer])

  const handleDragEnd = useCallback(() => {
    setDragging(false)
    triggerAction('land')
  }, [triggerAction])

  return {
    action,
    line,
    dragging,
    triggerAction,
    handleClick,
    handleDoubleClick,
    handleDragStart,
    handleDragEnd,
  }
}
