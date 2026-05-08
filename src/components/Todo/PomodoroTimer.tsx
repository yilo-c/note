import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'

interface PomodoroTimerProps {
  todoId: string
  noteId?: string
}

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ todoId, noteId }) => {
  const focusDuration = useStore(s => s.focusDuration)
  const incrementPomodoro = useStore(s => s.incrementPomodoro)
  const [active, setActive] = useState(false)
  const [remaining, setRemaining] = useState(focusDuration * 60 * 1000)
  const [paused, setPaused] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)
  const pickerRef = useRef<HTMLDivElement>(null)

  const pomodoroMs = focusDuration * 60 * 1000

  // Reset remaining when focus duration changes while idle
  useEffect(() => {
    if (!active) {
      setRemaining(focusDuration * 60 * 1000)
    }
  }, [focusDuration, active])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const notifyComplete = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🍅 番茄钟完成！', { body: '专注时间结束，休息一下吧！' })
    }
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch { /* audio not supported */ }
  }, [])

  const startTimer = useCallback((customMinutes?: number) => {
    const ms = (customMinutes ?? focusDuration) * 60 * 1000
    clearTimer()
    startTimeRef.current = Date.now()
    elapsedRef.current = 0
    setActive(true)
    setPaused(false)
    setRemaining(ms)

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current + elapsedRef.current
      const rem = Math.max(0, ms - elapsed)
      setRemaining(rem)

      if (rem <= 0) {
        clearTimer()
        setActive(false)
        setRemaining(ms)
        notifyComplete()
        if (noteId) incrementPomodoro(noteId)
      }
    }, 1000)
  }, [clearTimer, notifyComplete, incrementPomodoro, focusDuration, noteId])

  const pauseTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    elapsedRef.current += Date.now() - startTimeRef.current
    setPaused(true)
  }, [])

  const resetTimer = useCallback(() => {
    clearTimer()
    setActive(false)
    setPaused(false)
    setRemaining(pomodoroMs)
    elapsedRef.current = 0
  }, [clearTimer, pomodoroMs])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (paused) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
      startTimer()
    } else if (active) {
      pauseTimer()
    }
  }, [active, paused, startTimer, pauseTimer])

  const formatTime = (ms: number): string => {
    const totalSec = Math.ceil(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  const progress = 1 - remaining / pomodoroMs
  const rotateDeg = progress * 360

  return (
    <span className="inline-flex items-center gap-0.5 relative" onClick={e => e.stopPropagation()}>
      {!active && !paused ? (
        // Idle: show pomodoro icon → click opens duration picker
        <>
          <button
            onClick={e => {
              e.stopPropagation()
              if ('Notification' in window && Notification.permission === 'default') {
                Notification.requestPermission()
              }
              setShowPicker(!showPicker)
            }}
            className="flex-shrink-0 transition-all rounded text-[10px] px-1 py-0.5 text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
            title="选择番茄钟时长"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 inline-block" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M10 2v2M6.5 3.5l1 1.5M3.5 6.5l1.5 1M2 10h2M16 10h2M15.5 6.5l-1.5 1M13.5 3.5l-1 1.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          {showPicker && (
            <div ref={pickerRef}
              className="absolute top-full right-0 mt-1 z-50 bg-[rgba(18,18,28,0.96)] border border-white/[0.08] rounded-xl px-2 py-1.5 shadow-xl flex items-center gap-1"
            >
              {[15, 25, 30, 45, 60].map(d => (
                <button
                  key={d}
                  onClick={e => {
                    e.stopPropagation()
                    startTimer(d)
                    setShowPicker(false)
                  }}
                  className="text-[10px] px-2 py-1 rounded-lg transition-colors text-white/60 hover:text-white/80 hover:bg-white/[0.06]"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
      <button
        onClick={handleClick}
        className={`flex-shrink-0 transition-all rounded text-[10px] px-1 py-0.5
          ${active ? 'text-red-400/70' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.04]'}
          ${paused ? 'text-yellow-400/70' : ''}`}
        title={
          active
            ? paused
              ? `暂停中 ${formatTime(remaining)} — 点击继续`
              : `专注中 ${formatTime(remaining)} — 点击暂停`
            : `启动番茄钟 (${focusDuration}分钟)`
        }
      >
        <svg
          viewBox="0 0 20 20"
          className="w-4 h-4 inline-block"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={active && !paused ? { animation: 'pomodoro-spin 1s linear infinite' } : undefined}
        >
          {active && !paused ? (
            <>
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
              <circle
                cx="10" cy="10" r="8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray={`${progress * 50.24} ${50.24 - progress * 50.24}`}
                transform="rotate(-90, 10, 10)"
                opacity="0.8"
              />
              <text x="10" y="13" textAnchor="middle" fontSize="6" fill="currentColor" stroke="none">
                {formatTime(remaining)}
              </text>
            </>
          ) : paused ? (
            <>
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
              <rect x="6.5" y="6" width="2" height="8" rx="0.5" fill="currentColor" stroke="none" />
              <rect x="11.5" y="6" width="2" height="8" rx="0.5" fill="currentColor" stroke="none" />
            </>
          ) : null}
        </svg>
      </button>
      {active && (
        <button
          onClick={e => { e.stopPropagation(); resetTimer() }}
          className="text-[8px] text-white/30 hover:text-red-400/50 transition-colors"
          title="重置"
        >
          ✕
        </button>
      )}
        </>
      )}
    </span>
  )
}

export default PomodoroTimer
