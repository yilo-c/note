import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n'
import { uid } from '../../utils/helpers'
import { getAIProvider } from '../../utils/ai'

interface Props {
  isOpen: boolean
  onClose: () => void
}

type CaptureMode = 'auto' | 'note' | 'todo'

const QuickCapture: React.FC<Props> = ({ isOpen, onClose }) => {
  const addTodo = useStore(s => s.addTodo)
  const addFloatingNote = useStore(s => s.addFloatingNote)
  const activeCat = useStore(s => s.activeCat)
  const activeFolderId = useStore(s => s.activeFolderId)
  const aiConfig = useStore(s => s.aiConfig)
  const nextZ = useStore(s => s.nextZ)
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<CaptureMode>('auto')
  const [parsing, setParsing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setText('')
      setMode('auto')
      setParsing(false)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  /** Check if content has markdown checklist patterns */
  const hasChecklistItems = useCallback((content: string): boolean => {
    return /^- \[[ x]\] /m.test(content.trim())
  }, [])

  /** Extract checklist items from content */
  const extractChecklistTodos = useCallback((content: string): string[] => {
    return content
      .split('\n')
      .filter(line => /^- \[[ x]\] /.test(line))
      .map(line => line.replace(/^- \[[ x]\] /, '').trim())
      .filter(Boolean)
  }, [])

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipText = await navigator.clipboard.readText()
      if (clipText) {
        setText(prev => prev ? prev + '\n' + clipText : clipText)
      }
    } catch {
      // Clipboard access denied or not available
    }
  }, [])

  const submit = useCallback(async () => {
    const v = text.trim()
    if (!v) return

    const isAuto = mode === 'auto'
    const hasChecklist = hasChecklistItems(v)

    // If AI is enabled and in auto mode, try intent parsing
    if (isAuto && aiConfig.enabled && !hasChecklist) {
      setParsing(true)
      try {
        const provider = getAIProvider(aiConfig)
        const intent = await provider.parseIntent(v)
        setParsing(false)

        if (intent.type === 'create_todo') {
          addTodo(v, activeCat === 'all' ? undefined : activeCat)
          onClose()
          return
        } else if (intent.type === 'create_note' || (intent.type === 'unknown' && v.length > 30)) {
          addFloatingNote({
            id: uid(),
            type: 'text',
            title: intent.title || v.slice(0, 30),
            content: v,
            tags: intent.tags,
            folderId: activeFolderId || undefined,
            x: 120 + Math.random() * 80,
            y: 120 + Math.random() * 80,
            width: 280,
            height: 240,
            zIndex: nextZ,
          })
          onClose()
          return
        }
        // fall through to default
      } catch {
        setParsing(false)
        // fall through to default
      }
    }

    // Default/fallback behavior
    if (hasChecklist || mode === 'todo') {
      if (hasChecklist) {
        const items = extractChecklistTodos(v)
        for (const item of items) {
          addTodo(item, activeCat === 'all' ? undefined : activeCat)
        }
        // If there's non-checklist text before/after, also create a note
        const nonChecklist = v.split('\n').filter(line => !/^- \[[ x]\] /.test(line)).join('\n').trim()
        if (nonChecklist) {
          addFloatingNote({
            id: uid(),
            type: 'text',
            title: nonChecklist.slice(0, 30),
            content: v,
            folderId: activeFolderId || undefined,
            x: 120 + Math.random() * 80,
            y: 120 + Math.random() * 80,
            width: 280,
            height: 240,
            zIndex: nextZ,
          })
        }
      } else {
        addTodo(v, activeCat === 'all' ? undefined : activeCat)
      }
    } else {
      addFloatingNote({
        id: uid(),
        type: 'text',
        title: v.slice(0, 30),
        content: v,
        folderId: activeFolderId || undefined,
        x: 120 + Math.random() * 80,
        y: 120 + Math.random() * 80,
        width: 280,
        height: 240,
        zIndex: nextZ,
      })
    }

    onClose()
  }, [text, mode, aiConfig, activeCat, activeFolderId, nextZ, addTodo, addFloatingNote, onClose, hasChecklistItems, extractChecklistTodos])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submit()
    }
  }, [submit])

  // Expose submit for paste-and-capture from parent
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__quickCaptureSubmit = submit
    return () => { delete (window as unknown as Record<string, unknown>).__quickCaptureSubmit }
  }, [submit])

  if (!isOpen) return null

  const modeOptions: { value: CaptureMode; label: string; icon: string }[] = [
    { value: 'auto', label: t('quickCapture.modeAuto'), icon: 'fa-wand-magic-sparkles' },
    { value: 'note', label: t('quickCapture.modeNote'), icon: 'fa-note-sticky' },
    { value: 'todo', label: t('quickCapture.modeTodo'), icon: 'fa-list-check' },
  ]

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="border rounded-xl shadow-2xl backdrop-blur-xl w-[520px] max-w-[92vw] overflow-hidden"
        style={{ background: 'var(--panel-bg-solid)', borderColor: 'var(--border-color, rgba(255,255,255,0.08))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-bolt text-sm text-fluent-blue/60" />
            <span className="text-xs font-medium text-white/72">{t('quickCapture.title')}</span>
          </div>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1.5">
          {modeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all
                ${mode === opt.value
                  ? 'bg-fluent-blue/15 text-fluent-blue/80'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
            >
              <i className={`fa-solid ${opt.icon} text-[9px]`} />
              {opt.label}
            </button>
          ))}
          {parsing && (
            <span className="ml-auto text-[10px] text-fluent-blue/50 flex items-center gap-1">
              <i className="fa-solid fa-spinner fa-spin text-[9px]" />
              {t('quickCapture.parsing')}
            </span>
          )}
        </div>

        {/* Textarea */}
        <div className="px-3 py-1.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('quickCapture.placeholder')}
            rows={4}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/92 placeholder:text-white/30 outline-none resize-none focus:border-fluent-blue/30 transition-colors"
            style={{ minHeight: 80, maxHeight: 200 }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              title={t('quickCapture.pasteClipboard')}
            >
              <i className="fa-solid fa-paste text-[9px]" />
            </button>
            <span className="text-[10px] text-white/30">
              {t('quickCapture.charCount', { count: text.length })}
            </span>
            {text.trim() && hasChecklistItems(text) && (
              <span className="text-[10px] text-fluent-blue/50 flex items-center gap-0.5">
                <i className="fa-solid fa-list-check text-[8px]" />
                {t('quickCapture.detectedTodos', { count: extractChecklistTodos(text).length })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-lg text-[10px] text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={submit}
              disabled={!text.trim() || parsing}
              className="px-3 py-1 rounded-lg text-[10px] text-white/92 bg-fluent-blue/20 hover:bg-fluent-blue/30 transition-all disabled:opacity-30 flex items-center gap-1"
            >
              <i className="fa-solid fa-bolt text-[9px]" />
              {t('quickCapture.capture')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default QuickCapture
