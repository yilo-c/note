import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { streamAI, AIAction, AI_ACTION_ICONS } from '../../utils/ai'
import { useTranslation } from '../../i18n'
import { errorStore } from '../../store/errorStore'

interface AIToolbarProps {
  x: number
  y: number
  visible: boolean
  selectedText: string
  /** 笔记标题（用于 AI 上下文） */
  noteTitle?: string
  /** 笔记全文（用于 AI 上下文） */
  noteContent?: string
  containerEl: HTMLElement | null
  onClose: () => void
  onReplace: (text: string, action: AIAction) => void
  onOpenChat?: () => void
}

const ACTIONS: AIAction[] = ['continue', 'summarize', 'translate_zh', 'translate_en', 'polish']

const AIToolbar: React.FC<AIToolbarProps> = ({ x, y, visible, selectedText, noteTitle, containerEl, onClose, onReplace, onOpenChat }) => {
  const aiConfig = useStore(s => s.aiConfig)
  const { t } = useTranslation()
  const [loading, setLoading] = useState<AIAction | null>(null)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState('')
  const [completedResult, setCompletedResult] = useState<{ text: string; action: AIAction } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
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

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const handleAbort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(null)
    setStreamText('')
    setCompletedResult(null)
  }, [])

  const handleAction = useCallback(async (action: AIAction) => {
    if (!aiConfig.enabled || !selectedText.trim()) return
    setLoading(action)
    setError('')
    setStreamText('')
    setCompletedResult(null)

    const controller = new AbortController()
    abortRef.current = controller

    // Build context-augmented text: include note title for better AI understanding
    const contextText = noteTitle
      ? `【笔记标题】${noteTitle}\n\n${selectedText}`
      : selectedText

    await streamAI(
      aiConfig,
      action,
      contextText,
      (text) => setStreamText(text),
      (fullText) => {
        if (action === 'continue') {
          // 续写：直接替换（追加到选中内容后）
          setLoading(null)
          abortRef.current = null
          onReplace(fullText, action)
        } else {
          // 其他操作：显示预览弹窗，用户确认后再替换
          setLoading(null)
          abortRef.current = null
          setCompletedResult({ text: fullText, action })
        }
      },
      (err) => {
        setError(err)
        setLoading(null)
        abortRef.current = null
        errorStore.error(`AI 请求失败: ${err}`)
      },
    )
  }, [aiConfig, selectedText, noteTitle, onReplace])

  const handleReplaceResult = useCallback(() => {
    if (completedResult) {
      onReplace(completedResult.text, completedResult.action)
      setCompletedResult(null)
    }
  }, [completedResult, onReplace])

  const handleDismissResult = useCallback(() => {
    setCompletedResult(null)
  }, [])

  const actionLabelKey = (action: AIAction): string => {
    const map: Record<AIAction, string> = {
      continue: 'ai.toolbar.continue',
      summarize: 'ai.toolbar.summarize',
      translate_zh: 'ai.toolbar.translate_zh',
      translate_en: 'ai.toolbar.translate_en',
      polish: 'ai.toolbar.polish',
      organize: 'ai.toolbar.organize',
    }
    return map[action]
  }

  if (!visible) return null
  if (!aiConfig.enabled) return null

  return (
    <>
      {/* Action buttons */}
      <div
        ref={barRef}
        className="fixed z-[9999] flex items-center gap-0.5 rounded-lg px-1.5 py-1 shadow-2xl backdrop-blur-xl"
        style={{ background: 'var(--panel-bg-solid, rgba(28,28,38,0.95))', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}
        onMouseDown={e => e.preventDefault()}
      >
        {ACTIONS.map(action => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            disabled={loading !== null || !!completedResult}
            className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-all
              ${loading === action ? 'text-fluent-blue/70 animate-pulse' : 'hover:bg-white/[0.06]'}
              disabled:opacity-40`}
            style={{ color: loading === action ? undefined : 'var(--text-secondary, rgba(255,255,255,0.72))' }}
            title={t(actionLabelKey(action))}
          >
            {loading === action ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <i className={`fa-solid ${AI_ACTION_ICONS[action]}`} />
            )}
          </button>
        ))}

        {/* Separator + Chat button */}
        <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
        <button
          onClick={onOpenChat}
          className="w-7 h-7 flex items-center justify-center rounded text-xs transition-all hover:bg-white/[0.06]"
          style={{ color: 'var(--text-secondary, rgba(255,255,255,0.72))' }}
          title={t('ai.chat.title')}
        >
          <i className="fa-solid fa-comment-dots" />
        </button>
      </div>

      {/* Streaming result popup */}
      {loading && streamText && (
        <div
          ref={resultRef}
          className="fixed z-[9999] border rounded-lg px-3 py-2 shadow-2xl backdrop-blur-xl max-w-[320px] min-w-[200px]"
          style={{ background: 'var(--panel-bg-solid, rgba(28,28,38,0.97))', borderColor: 'var(--border-color, rgba(255,255,255,0.08))', left: Math.max(8, x - 160), top: y + 10 }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] text-white/80 leading-relaxed max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words flex-1">
              {streamText}
              <span className="inline-block w-[2px] h-[13px] bg-fluent-blue/60 ml-0.5 animate-pulse" />
            </div>
            <button
              onClick={handleAbort}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
              title={t('common.cancel')}
            >
              <i className="fa-solid fa-xmark text-[10px]" />
            </button>
          </div>
        </div>
      )}

      {/* Completed result preview (for non-continue actions) */}
      {completedResult && !loading && (
        <div
          ref={resultRef}
          className="fixed z-[9999] rounded-lg px-3 py-2 shadow-2xl backdrop-blur-xl max-w-[320px] min-w-[200px]"
          style={{
            background: 'var(--panel-bg-solid, rgba(28,28,38,0.97))',
            border: '1px solid rgba(96,165,250,0.25)',
            left: Math.max(8, x - 160),
            top: y + 10,
          }}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-medium text-fluent-blue/60 flex items-center gap-1">
              <i className="fa-solid fa-check-circle text-[9px]" />
              {t(actionLabelKey(completedResult.action))}
            </span>
            <button
              onClick={handleDismissResult}
              className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <i className="fa-solid fa-xmark text-[10px]" />
            </button>
          </div>
          <div className="text-[11px] text-white/80 leading-relaxed max-h-[120px] overflow-y-auto whitespace-pre-wrap break-words mb-2">
            {completedResult.text}
          </div>
          <div className="flex items-center gap-1.5 justify-end border-t border-white/[0.06] pt-1.5">
            <button
              onClick={handleDismissResult}
              className="px-2 py-1 rounded text-[10px] text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleReplaceResult}
              className="px-2 py-1 rounded text-[10px] text-white/92 bg-fluent-blue/20 hover:bg-fluent-blue/30 transition-all"
            >
              {t('ai.resultPreview.replace')}
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && !loading && !completedResult && (
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
