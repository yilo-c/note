import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { streamAI, AIAction, AI_ACTION_LABELS, AI_ACTION_ICONS } from '../../utils/ai'

interface AIToolbarProps {
  x: number
  y: number
  visible: boolean
  selectedText: string
  containerEl: HTMLElement | null
  onClose: () => void
  onReplace: (text: string) => void
}

const ACTIONS: AIAction[] = ['continue', 'summarize', 'translate_zh', 'translate_en', 'polish']

const AIToolbar: React.FC<AIToolbarProps> = ({ x, y, visible, selectedText, containerEl, onClose, onReplace }) => {
  const aiConfig = useStore(s => s.aiConfig)
  const [loading, setLoading] = useState<AIAction | null>(null)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const barRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !barRef.current) return
    const bar = barRef.current
    const barW = bar.offsetWidth
    const container = containerEl || document.body
    const cRect = container.getBoundingClientRect()
    let adjustedX = x - barW / 2
    if (adjustedX + barW > cRect.right - 8) adjustedX = cRect.right - barW - 8
    if (adjustedX < cRect.left + 8) adjustedX = cRect.left + 8
    bar.style.left = `${adjustedX}px`
    bar.style.top = `${y - 44}px`
  }, [x, y, visible, containerEl])

  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node) &&
          resultRef.current && !resultRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler) }
  }, [visible, onClose])

  const handleAction = useCallback(async (action: AIAction) => {
    if (!aiConfig.enabled || !selectedText.trim()) return
    setLoading(action)
    setError('')
    setResult('')

    await streamAI(
      aiConfig.apiUrl,
      aiConfig.model,
      action,
      selectedText,
      (text) => setResult(text),
      (fullText) => {
        setLoading(null)
        onReplace(fullText)
      },
      (err) => {
        setError(err)
        setLoading(null)
      },
    )
  }, [aiConfig, selectedText, onReplace])

  if (!visible) return null
  if (!aiConfig.enabled) return null

  return (
    <>
      <div
        ref={barRef}
        className="fixed z-[9999] flex items-center gap-0.5 bg-[rgba(28,28,38,0.95)] border border-white/[0.08] rounded-lg px-1.5 py-1 shadow-2xl backdrop-blur-xl"
        onMouseDown={e => e.preventDefault()}
      >
        {ACTIONS.map(action => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={loading !== null}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-all
              ${loading === action ? 'text-fluent-blue/70 animate-pulse' : 'text-white/72 hover:text-white hover:bg-white/[0.06]'}
              disabled:opacity-40`}
            title={AI_ACTION_LABELS[action]}
          >
            {loading === action ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <i className={`fa-solid ${AI_ACTION_ICONS[action]}`} />
            )}
          </button>
        ))}
      </div>
      {/* Error display */}
      {error && (
        <div
          ref={resultRef}
          className="fixed z-[9999] bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 shadow-2xl backdrop-blur-xl max-w-[260px]"
          style={{ left: x - 130, top: y + 10 }}
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-400/60 text-[10px]" />
            <span className="text-[10px] text-red-400/70">{error}</span>
          </div>
        </div>
      )}
    </>
  )
}

export default AIToolbar
