import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { getAIProvider } from '../../utils/ai'
import type { AIConfig } from '../../types'
import { useTranslation } from '../../i18n'

// ── Types ──

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  action?: EditorAction | null
}

export interface EditorAction {
  action: 'replace_selection' | 'insert_at_cursor' | 'append' | 'prepend' | 'replace_full'
  text: string
}

interface AIChatPanelProps {
  noteId: string
  noteContent: string
  noteTitle: string
  onClose: () => void
  initialX?: number
  initialY?: number
  editorSelectedText?: string
  onApplyAction?: (action: EditorAction) => void
}

// ── Model presets ──

type ModelPresetId = 'global' | 'qwen' | 'gpt4o' | 'deepseek'

function getModelPresets(t: (key: string) => string): Record<ModelPresetId, { label: string; shortLabel: string; config?: Partial<AIConfig> }> {
  return {
    global: { label: t('ai.chat.presetDefault'), shortLabel: t('ai.chat.presetDefaultShort') },
    qwen: { label: t('ai.chat.presetQwen'), shortLabel: t('ai.chat.presetQwenShort'), config: { protocol: 'ollama', apiUrl: 'http://localhost:11434', model: 'qwen2.5-coder:3b' } },
    gpt4o: { label: t('ai.chat.presetGPT'), shortLabel: t('ai.chat.presetGPTShort'), config: { protocol: 'openai', apiUrl: 'https://api.openai.com/v1', model: 'gpt-4o' } },
    deepseek: { label: t('ai.chat.presetDeepSeek'), shortLabel: t('ai.chat.presetDeepSeekShort'), config: { protocol: 'openai', apiUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' } },
  }
}

// ── Dimensions ──

const W = 280
const H = 150
const MAX_H = 200

// ── Parsing ──

/** Parse 【AI_ACTION】{json}【/AI_ACTION】marker from the end of AI response */
function parseActionMarker(rawText: string): { displayText: string; action: EditorAction | null } {
  const markerRegex = /【AI_ACTION】(.+?)【\/AI_ACTION】/;
  const match = rawText.match(markerRegex);
  if (match) {
    try {
      const action = JSON.parse(match[1]);
      if (typeof action === 'object' && action !== null && typeof action.action === 'string' && typeof action.text === 'string') {
        const displayText = rawText.replace(markerRegex, '').trim();
        return { displayText, action: { action: action.action, text: action.text } };
      }
    } catch { /* invalid JSON, ignore */ }
  }
  return { displayText: rawText, action: null };
}


// ── Component ──

const AIChatPanel: React.FC<AIChatPanelProps> = ({
  noteId: _noteId, noteContent, noteTitle, onClose, initialX, initialY,
  editorSelectedText, onApplyAction,
}) => {
  const aiConfig = useStore(s => s.aiConfig)
  const { t } = useTranslation()
  const MODEL_PRESETS = getModelPresets(t)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [appliedSet, setAppliedSet] = useState<Set<number>>(new Set())
  const [pos, setPos] = useState(() => ({
    x: initialX ?? Math.max(16, (window.innerWidth - W) / 2),
    y: initialY ?? Math.max(16, (window.innerHeight - H) / 2),
  }))
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastUserInputRef = useRef('')
  const [selectedModel, setSelectedModel] = useState<ModelPresetId>('global')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Close model picker on outside click
  useEffect(() => {
    if (!showModelPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showModelPicker])

  const handleAbort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
  }, [])

  const getMergedConfig = useCallback(() => {
    const preset = MODEL_PRESETS[selectedModel]
    return preset.config ? { ...aiConfig, ...preset.config } : aiConfig
  }, [selectedModel, aiConfig])

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    } catch { /* ignore */ }
  }, [])

  // ── Send ──

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !aiConfig.enabled) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    lastUserInputRef.current = text

    setLoading(true)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // ── Build prompt with action instructions ──
    const stripped = noteContent.replace(/<[^>]*>/g, '').trim()

    const parts: string[] = [
      '你是一个智能笔记助手。你可以通过动作标记直接修改笔记内容。',
      '',
      '可用动作：',
      '- replace_selection：替换用户选中的文本。',
      '- insert_at_cursor：在光标位置插入新内容（无选中时）',
      '- append：在笔记末尾追加内容',
      '- prepend：在笔记开头插入内容。',
      '- replace_full：替换全部笔记内容。',
      '',
      '当用户要求修改笔记时，在回复末尾添加动作标记：',
      '【AI_ACTION】{"action":"replace_selection","text":"替换后的文字"}【/AI_ACTION】',
      '如果是普通对话（提问、闲聊等），不要添加动作标记。',
      '',
      '当前笔记内容：',
      stripped || '（空）',
    ]

    if (editorSelectedText) {
      parts.push(t('ai.chat.userSelected'))
      parts.push(editorSelectedText)
      parts.push('')
    }

    for (const msg of messages) {
      const prefix = msg.role === 'user' ? t('ai.chat.userLabel') : t('ai.chat.assistantLabel')
      parts.push(`${prefix}：${msg.content}`)
    }
    parts.push('')
    parts.push(`用户：${text}`)
    parts.push(`助手：\n`)

    const prompt = parts.join('\n')

    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const merged = getMergedConfig()
      const provider = getAIProvider({
        enabled: true,
        apiUrl: merged.apiUrl,
        model: merged.model,
        protocol: merged.protocol,
        autoTagging: false,
        ...(merged.apiKey ? { apiKey: merged.apiKey } : {}),
      })

      await provider.processText(
        'continue',
        prompt,
        (chunk) => {
          // Strip action markers from streaming display
          const clean = chunk.replace(/【AI_ACTION】[\s\S]*?(【\/AI_ACTION】|$)/g, '').trim()
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { role: 'assistant', content: clean || chunk }
            return copy
          })
        },
        controller.signal,
      )

      // After streaming completes, parse action marker from the full response
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last && last.role === 'assistant' && last.content) {
          const parsed = parseActionMarker(last.content)
          copy[copy.length - 1] = { role: 'assistant', content: parsed.displayText, action: parsed.action }
        }
        return copy
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => {
        const copy = [...prev]
        const errMsg = err instanceof Error ? err.message : t('ai.askFailed')
        copy[copy.length - 1] = { role: 'assistant', content: `[${t('common.error')}] ${errMsg}` }
        return copy
      })
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [input, messages, loading, aiConfig, noteContent, t, getMergedConfig, editorSelectedText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApply = useCallback((idx: number, action: EditorAction) => {
    onApplyAction?.(action)
    setAppliedSet(prev => new Set([...prev, idx]))
  }, [onApplyAction])

  const handleRetry = useCallback(() => {
    const lastInput = lastUserInputRef.current
    if (!lastInput) return
    setInput(lastInput)
  }, [])

  // ── Drag ──

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      setPos({
        x: dragRef.current.origX + ev.clientX - dragRef.current.startX,
        y: dragRef.current.origY + ev.clientY - dragRef.current.startY,
      })
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  // ── Render ──

  return (
    <div
      ref={panelRef}
      className="fixed z-[99999] flex flex-col rounded-xl shadow-2xl border overflow-hidden"
      style={{
        width: W,
        maxWidth: 280,
        height: H,
        maxHeight: MAX_H,
        left: pos.x,
        top: pos.y,
        background: 'var(--panel-bg-solid, rgba(28,28,38,0.97))',
        borderColor: 'var(--border-color, rgba(255,255,255,0.08))',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-2 py-1.5 border-b border-white/[0.06] flex-shrink-0 select-none"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <i className="fa-solid fa-comment-dots text-fluent-blue/60 text-[10px] flex-shrink-0" />
          <span className="text-[10px] text-white/72 whitespace-nowrap">{t('ai.chat.title')}</span>
          <span className="text-[8px] text-white/35 truncate max-w-[100px]">{noteTitle}</span>
        </div>
        <button
          onClick={onClose}
          className="w-4 h-4 flex items-center justify-center rounded text-white/35 hover:text-white hover:bg-white/[0.08] transition-all flex-shrink-0"
        >
          <i className="fa-solid fa-xmark text-[8px]" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1.5 min-h-0 select-text">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-[10px] text-white/25 px-3 text-center select-none">
            {t('ai.chat.placeholder')}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="group relative max-w-[88%]">
              <div
                className={`rounded-lg px-2 py-1 text-[10px] leading-relaxed whitespace-pre-wrap break-words ${
                  msg.role === 'user'
                    ? 'bg-fluent-blue/15 text-white/90'
                    : 'bg-white/[0.06] text-white/80'
                }`}
              >
                {msg.content || (loading && i === messages.length - 1 ? (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : null)}
              </div>
              {/* Copy button —?appears on hover */}
              {msg.content && !(loading && i === messages.length - 1) && (
                <button
                  onClick={() => handleCopy(msg.content, i)}
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-white/35 hover:text-white hover:bg-white/[0.1] transition-all opacity-0 group-hover:opacity-100"
                  title={t('note.copyContent')}
                >
                  <i className={`fa-solid ${copiedIdx === i ? 'fa-check' : 'fa-copy'} text-[7px]`} />
                </button>
              )}
            </div>
            {/* Apply button —?for assistant messages with pending action */}
            {msg.role === 'assistant' && msg.action && onApplyAction && !appliedSet.has(i) && (
              <button
                onClick={() => handleApply(i, msg.action!)}
                className="mt-0.5 px-2 py-0.5 rounded text-[8px] text-fluent-blue/70 hover:text-fluent-blue hover:bg-fluent-blue/[0.08] transition-all"
              >
                <i className="fa-solid fa-arrow-right-to-bracket mr-1" />
                {t('ai.resultPreview.replace')}
              </button>
            )}
            {msg.role === 'assistant' && msg.action && appliedSet.has(i) && (
              <span className="mt-0.5 text-[8px] text-green-400/50">{t('ai.actionApplied')}</span>
            )}
            {msg.role === 'assistant' && msg.content?.startsWith(`[${t('common.error')}]`) && !loading && (
              <button
                onClick={handleRetry}
                className="mt-0.5 px-2 py-0.5 rounded text-[8px] text-amber-400/70 hover:text-amber-400 hover:bg-amber-400/[0.08] transition-all"
              >
                <i className="fa-solid fa-rotate mr-1" />
                {t('common.retry')}
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-white/[0.06] px-2 py-1 flex items-center gap-1 flex-shrink-0 select-none">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('ai.chat.inputPlaceholder')}
          disabled={loading}
          className="flex-1 bg-white/[0.06] rounded-lg px-2 py-1 text-[10px] text-white/80 placeholder:text-white/35 outline-none border border-white/[0.04] focus:border-white/[0.1] transition-colors disabled:opacity-40"
        />

        {/* Model selector */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            disabled={loading}
            className="w-5 h-5 flex items-center justify-center rounded text-[8px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all disabled:opacity-30"
            title={MODEL_PRESETS[selectedModel].label}
          >
            {MODEL_PRESETS[selectedModel].shortLabel}
          </button>
          {showModelPicker && (
            <div
              className="absolute bottom-full right-0 mb-1 z-50 border rounded-lg py-1 shadow-xl min-w-[130px]"
              style={{ background: 'var(--panel-bg-solid, rgba(28,28,38,0.97))', borderColor: 'var(--border-color, rgba(255,255,255,0.08))' }}
            >
              {(Object.entries(MODEL_PRESETS) as [ModelPresetId, typeof MODEL_PRESETS[ModelPresetId]][]).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => { setSelectedModel(id); setShowModelPicker(false) }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] transition-all"
                  style={{ color: selectedModel === id ? 'var(--text-primary, rgba(255,255,255,0.92))' : 'var(--text-secondary, rgba(255,255,255,0.55))' }}
                >
                  {selectedModel === id && <i className="fa-solid fa-check text-[8px] text-fluent-blue" />}
                  {selectedModel !== id && <span className="w-[8px]" />}
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Send / Abort */}
        {loading ? (
          <button
            onClick={handleAbort}
            className="w-5 h-5 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
            title={t('common.cancel')}
          >
            <i className="fa-solid fa-stop text-[9px]" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || !aiConfig.enabled}
            className="w-5 h-5 flex items-center justify-center rounded-lg text-fluent-blue/60 hover:text-fluent-blue hover:bg-fluent-blue/[0.08] transition-all disabled:opacity-30"
            title={t('ai.chat.send')}
          >
            <i className="fa-solid fa-paper-plane text-[9px]" />
          </button>
        )}
      </div>
    </div>
  )
}

export default AIChatPanel
