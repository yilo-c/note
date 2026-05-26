import React, { useRef, useState, useEffect, useCallback, useLayoutEffect, Suspense } from 'react'
import { useStore } from '../../store/useStore'
import { onContentEdit, flushPendingEdit } from '../../store/contentEditTracker'
import { stripHtml } from '../../utils/helpers'
import { saveMedia, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE } from '../../utils/imageStore'
import { getAIProvider } from '../../utils/ai'
import { sanitizeHtml } from '../../utils/sanitize'
import { useTranslation } from '../../i18n'
import FormatToolbar from '../FloatingNote/FormatToolbar'
import ContextMenu from '../Common/ContextMenu'
import { useNoteEditorImages } from './useNoteEditorImages'
import SlashCommandMenu from './SlashCommandMenu'
import { errorStore } from '../../store/errorStore'
import type { SlashCommand } from './SlashCommandMenu'

const MdPreview = React.lazy(() => import('../FloatingNote/MdPreview'))

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'continue', label: '续写', icon: 'fa-solid fa-feather', action: 'continue' },
  { id: 'polish', label: '润色', icon: 'fa-solid fa-wand-magic', action: 'polish' },
  { id: 'summarize', label: '总结', icon: 'fa-solid fa-compress', action: 'summarize' },
  { id: 'translate', label: '翻译', icon: 'fa-solid fa-language', action: 'translate_zh' },
  { id: 'translate_en', label: '译英', icon: 'fa-solid fa-language', action: 'translate_en' },
  { id: 'organize', label: 'AI 整理', icon: 'fa-solid fa-broom', action: 'organize' },
]

const NoteEditor: React.FC = () => {
  const { t } = useTranslation()
  const editingNoteId = useStore(s => s.editingNoteId)
  const note = useStore(s => editingNoteId ? s.floatingNotes.find(n => n.id === editingNoteId) : undefined)
  const updateFloatingNote = useStore(s => s.updateFloatingNote)
  const setEditingNoteId = useStore(s => s.setEditingNoteId)
  const removeFloatingNote = useStore(s => s.removeFloatingNote)

  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit')
  const [editMode, setEditMode] = useState<'richtext' | 'markdown'>('richtext')
  const [mdContent, setMdContent] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const committedContentRef = useRef('')
  const img = useNoteEditorImages(note, editorRef, updateFloatingNote, editMode)

  const aiConfig = useStore(s => s.aiConfig)
  const [organizing, setOrganizing] = useState(false)
  const [organizeResult, setOrganizeResult] = useState<string | null>(null)
  const organizeAbortRef = useRef<AbortController | null>(null)

  // ── Slash command menu ──
  const [slashMenu, setSlashMenu] = useState<{ x: number; y: number } | null>(null)
  const slashDeferredRef = useRef(false)

  // ── AI autocomplete ──
  const [aiAutocomplete, setAiAutocomplete] = useState<{ text: string; loading: boolean } | null>(null)
  const autocompleteAbortRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => { organizeAbortRef.current?.abort(); autocompleteAbortRef.current?.abort() }
  }, [])

  // Initialize from note data when note changes
  useEffect(() => {
    if (!note) return
    setEditMode(note.editMode || 'richtext')
    setViewMode(note.contentViewMode || 'edit')
  }, [note?.id])

  // Sync markdown buffer when switching to markdown mode
  useEffect(() => {
    if (!note || editMode !== 'markdown') return
    setMdContent(prev => prev || stripHtml(note.content || ''))
  }, [editMode, note?.id, note?.content])

  // Sync contentEditable when content changes externally (useLayoutEffect to avoid flash)
  useLayoutEffect(() => {
    if (!note || editMode !== 'richtext' || !editorRef.current) return
    const el = editorRef.current
    const newContent = note.content || ''
    if (committedContentRef.current !== newContent) {
      el.innerHTML = sanitizeHtml(newContent)
      committedContentRef.current = newContent
    }
  }, [note?.id, note?.content, editMode])

  // Flush pending edits on unmount
  useEffect(() => {
    return () => { flushPendingEdit() }
  }, [])

  const handleTitleChange = useCallback((val: string) => {
    if (!note) return
    updateFloatingNote(note.id, { title: val })
  }, [note, updateFloatingNote])

  const handleContentInput = useCallback(() => {
    if (!note || !editorRef.current) return
    const html = editorRef.current.innerHTML
    if (html === committedContentRef.current) return
    committedContentRef.current = html
    onContentEdit(note.id)
    updateFloatingNote(note.id, { content: html })

    // Slash command detection
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editMode === 'richtext') {
      const range = sel.getRangeAt(0)
      const textBefore = range.startContainer?.textContent?.slice(0, range.startOffset) || ''
      if (textBefore.endsWith('/') && !slashDeferredRef.current) {
        slashDeferredRef.current = true
        requestAnimationFrame(() => {
          slashDeferredRef.current = false
          const rect = range.getBoundingClientRect()
          setSlashMenu({ x: Math.max(0, rect.left), y: rect.bottom + 4 })
        })
      }
    }
    if (aiAutocomplete) setAiAutocomplete(null)
  }, [note, updateFloatingNote, editMode, aiAutocomplete])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files)
    const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (mediaFiles.length === 0) return

    e.preventDefault()
    const sel = window.getSelection()
    const range = sel?.getRangeAt(0)

    for (const file of mediaFiles) {
      const isVideo = file.type.startsWith('video/')
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
      if (file.size > maxSize) continue

      const reader = new FileReader()
      reader.onload = async (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string
        const src = await saveMedia(dataUrl, file.name)

        if (isVideo) {
          const video = document.createElement('video')
          video.src = src
          video.controls = true
          video.style.maxWidth = '100%'
          video.style.maxHeight = '400px'
          video.style.display = 'block'
          video.setAttribute('data-asset', src.startsWith('assets://') ? '1' : '0')
          if (range) {
            range.deleteContents()
            range.insertNode(video)
            range.collapse(false)
          }
        } else {
          const img = document.createElement('img')
          img.src = src
          img.alt = file.name || 'pasted image'
          img.style.maxWidth = '100%'
          img.style.height = 'auto'
          img.setAttribute('data-asset', src.startsWith('assets://') ? '1' : '0')
          if (range) {
            range.deleteContents()
            range.insertNode(img)
            range.collapse(false)
          }
        }

        if (!note) return
        onContentEdit(note.id)
        const el = editorRef.current
        if (el) updateFloatingNote(note.id, { content: el.innerHTML })
      }
      reader.readAsDataURL(file)
    }
  }, [note, updateFloatingNote])

  // ── Editor keyboard handler: Ctrl+I autocomplete, slash menu Tab/Esc ──
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Esc → close slash menu or dismiss autocomplete
    if (e.key === 'Escape') {
      if (slashMenu) { setSlashMenu(null); e.preventDefault(); return }
      if (aiAutocomplete) { setAiAutocomplete(null); autocompleteAbortRef.current?.abort(); e.preventDefault(); return }
    }
    // Tab → accept autocomplete
    if (e.key === 'Tab' && aiAutocomplete && !aiAutocomplete.loading) {
      e.preventDefault()
      if (!editorRef.current) return
      document.execCommand('insertText', false, aiAutocomplete.text)
      setAiAutocomplete(null)
      return
    }
    // Ctrl+I → trigger autocomplete
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      if (!note || !aiConfig.enabled || aiAutocomplete?.loading) return
      // Dismiss existing
      autocompleteAbortRef.current?.abort()
      const plainText = stripHtml(note.content || '').trim()
      if (plainText.length < 30) return

      const controller = new AbortController()
      autocompleteAbortRef.current = controller
      setAiAutocomplete({ text: '', loading: true })

      const provider = getAIProvider({
        enabled: true,
        apiUrl: aiConfig.apiUrl,
        model: aiConfig.model,
        protocol: aiConfig.protocol,
        autoTagging: false,
        ...(aiConfig.apiKey ? { apiKey: aiConfig.apiKey } : {}),
      })

      provider.processText('continue', plainText, (chunk) => {
        setAiAutocomplete(prev => prev ? { text: chunk, loading: false } : null)
      }, controller.signal).then(fullText => {
        setAiAutocomplete(prev => prev ? { text: fullText, loading: false } : null)
      }).catch((err: Error) => {
        if (err.name === 'AbortError') return
        setAiAutocomplete(null)
      })
    }
  }, [note, aiConfig, slashMenu, aiAutocomplete])

  const handleMdChange = useCallback((val: string) => {
    setMdContent(val)
    if (!note) return
    onContentEdit(note.id)
    updateFloatingNote(note.id, { content: val })
  }, [note, updateFloatingNote])

  const handleFloat = useCallback(() => {
    if (!note) return
    updateFloatingNote(note.id, { floated: true, zIndex: 999999 })
    setEditingNoteId(null)
  }, [note, updateFloatingNote, setEditingNoteId])

  const handleDelete = useCallback(() => {
    if (!note) return
    removeFloatingNote(note.id)
    setEditingNoteId(null)
  }, [note, removeFloatingNote, setEditingNoteId])

  // ── Idle detection + suggestion bubble ──
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestedRef = useRef(false)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const resetIdleTimer = useCallback(() => {
    if (!aiConfig.enabled || suggestedRef.current) return
    clearIdleTimer()
    idleTimerRef.current = setTimeout(() => {
      if (!note) return
      const plainText = stripHtml(note.content || '').trim()
      if (plainText.length < 100) return // too short to need organizing
      // Heuristic: content with few line breaks relative to length might be messy
      const lines = plainText.split('\n').length
      const avgLineLen = plainText.length / lines
      if (avgLineLen > 80 && plainText.length > 200) {
        suggestedRef.current = true
        setSuggestionText(t('note.aiOrganize.suggestion'))
        setShowSuggestion(true)
      }
    }, 8000)
  }, [aiConfig.enabled, note, clearIdleTimer])

  // Restart idle timer when content changes
  useEffect(() => {
    if (!note || editMode !== 'richtext') return
    resetIdleTimer()
    return clearIdleTimer
  }, [note?.content, editMode, resetIdleTimer, clearIdleTimer])

  // Reset suggestion when switching notes
  useEffect(() => {
    suggestedRef.current = false
    setShowSuggestion(false)
  }, [note?.id])

  const handleOrganize = useCallback(async () => {
    if (!note || !aiConfig.enabled || organizing) return
    const plainText = stripHtml(note.content || '').trim()
    if (!plainText) return

    setOrganizing(true)
    setOrganizeResult(null)
    const controller = new AbortController()
    organizeAbortRef.current = controller

    try {
      const provider = getAIProvider({
        enabled: true,
        apiUrl: aiConfig.apiUrl,
        model: aiConfig.model,
        protocol: aiConfig.protocol,
        autoTagging: false,
        ...(aiConfig.apiKey ? { apiKey: aiConfig.apiKey } : {}),
      })
      const result = await provider.processText('organize', plainText, () => {}, controller.signal)
      setOrganizeResult(result)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      errorStore.error('AI 整理失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setOrganizing(false)
      organizeAbortRef.current = null
    }
  }, [note, aiConfig, organizing])

  const handleSuggestOrganize = useCallback(() => {
    setShowSuggestion(false)
    handleOrganize()
  }, [handleOrganize])

  const handleDismissSuggestion = useCallback(() => {
    setShowSuggestion(false)
  }, [])

  // ── Slash command selection ──
  const handleSlashCommand = useCallback(async (cmd: SlashCommand) => {
    setSlashMenu(null)
    if (!note || !editorRef.current || !aiConfig.enabled) return
    // Remove the trailing / from editor content
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      const node = range.startContainer
      const offset = range.startOffset
      if (node?.textContent) {
        const text = node.textContent
        const slashIdx = text.lastIndexOf('/', offset)
        if (slashIdx !== -1) {
          node.textContent = text.slice(0, slashIdx) + text.slice(offset)
          range.setStart(node, slashIdx)
          range.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range)
        }
      }
    }

    const plainText = stripHtml(note.content || '').replace(/\/$/, '').trim()
    if (!plainText) return

    const controller = new AbortController()
    organizeAbortRef.current = controller
    setOrganizing(true)
    try {
      const provider = getAIProvider({
        enabled: true,
        apiUrl: aiConfig.apiUrl,
        model: aiConfig.model,
        protocol: aiConfig.protocol,
        autoTagging: false,
        ...(aiConfig.apiKey ? { apiKey: aiConfig.apiKey } : {}),
      })
      const result = await provider.processText(cmd.action, plainText, () => {}, controller.signal)
      setOrganizeResult(result)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      errorStore.error('AI 操作失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setOrganizing(false)
      organizeAbortRef.current = null
    }
  }, [note, aiConfig])

  const handleApplyOrganize = useCallback(() => {
    if (!note || !organizeResult) return
    // Convert organized plain text to HTML-safe content
    const temp = document.createElement('div')
    temp.textContent = organizeResult
    const safeHtml = temp.innerHTML
    updateFloatingNote(note.id, { content: safeHtml })
    setOrganizeResult(null)
    onContentEdit(note.id)
  }, [note, organizeResult, updateFloatingNote])

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/40 text-[10px]">
        {t('common.notFound')}
      </div>
    )
  }

  const isMarkdown = editMode === 'markdown'
  const showEdit = viewMode === 'edit' || viewMode === 'split'
  const showPreview = viewMode === 'preview' || viewMode === 'split'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top bar: back + title + actions */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-white/[0.04]">
        <button
          onClick={() => setEditingNoteId(null)}
          className="flex items-center gap-1 text-[9px] text-white/50 hover:text-white/80 transition-colors"
        >
          <i className="fa-solid fa-chevron-left text-[8px]" />
          {t('kanban.backToList')}
        </button>
        <div className="flex-1" />
        {aiConfig.enabled && (
          <button
            onClick={handleOrganize}
            disabled={organizing}
            className="flex items-center gap-1 text-[9px] text-white/50 hover:text-fluent-blue/70 transition-colors disabled:opacity-40"
            title={t('ai.toolbar.organize')}
          >
            <i className={`fa-solid ${organizing ? 'fa-spinner fa-spin' : 'fa-broom'} text-[8px]`} />
            {organizing ? t('note.aiOrganize.organizing') : t('note.aiOrganize.organize')}
          </button>
        )}
        <button
          onClick={handleFloat}
          className="flex items-center gap-1 text-[9px] text-white/50 hover:text-white/80 transition-colors"
          title={t('note.floatMode')}
        >
          <i className="fa-regular fa-window-restore text-[8px]" />
        </button>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 text-[9px] text-white/50 hover:text-red-400/60 transition-colors"
          title={t('common.delete')}
        >
          <i className="fa-regular fa-trash-can text-[8px]" />
        </button>
      </div>

      {/* Title */}
      <div className="px-3 pt-2 pb-1">
        <input
          value={note.title || ''}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder={t('note.newNote')}
          className="w-full bg-transparent text-[11px] font-medium outline-none text-white/92 placeholder:text-white/30"
        />
      </div>

      {/* FormatToolbar (fixed horizontal bar) */}
      <div className="px-2 pb-1">
        <FormatToolbar
          x={0} y={0} visible={true} containerEl={null} onClose={() => {}}
          fixed
          viewMode={viewMode}
          editMode={editMode}
          onViewModeChange={setViewMode}
          onEditModeChange={setEditMode}
          noteId={note.id}
        />
      </div>

      {/* Organize result modal */}
      {organizeResult !== null && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="rounded-xl border shadow-2xl max-w-[90%] max-h-[85%] w-[700px] flex flex-col"
            style={{ background: 'var(--panel-bg-solid, rgba(28,28,38,0.98))', borderColor: 'var(--border-color, rgba(255,255,255,0.08))' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] flex-shrink-0">
              <span className="text-[11px] font-medium text-white/80 flex items-center gap-1.5">
                <i className="fa-solid fa-broom text-fluent-blue/60 text-[10px]" />
                {t('note.aiOrganize.resultTitle')}
              </span>
              <button
                onClick={() => setOrganizeResult(null)}
                className="w-5 h-5 flex items-center justify-center rounded text-white/35 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <i className="fa-solid fa-xmark text-[9px]" />
              </button>
            </div>
            {/* Content: side-by-side */}
            <div className="flex-1 flex min-h-0">
              {/* Original */}
              <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
                <div className="px-3 py-1.5 text-[8px] text-white/35 uppercase tracking-wider border-b border-white/[0.04] flex-shrink-0">
                  {t('note.aiOrganize.original')}
                </div>
                <div className="flex-1 overflow-y-auto p-3 text-[10px] text-white/60 leading-relaxed whitespace-pre-wrap select-text">
                  {stripHtml(note?.content || '')}
                </div>
              </div>
              {/* Organized */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-3 py-1.5 text-[8px] text-fluent-blue/50 uppercase tracking-wider border-b border-white/[0.04] flex-shrink-0">
                  {t('note.aiOrganize.organized')}</div>
                <div className="flex-1 overflow-y-auto p-3 text-[10px] text-white/92 leading-relaxed whitespace-pre-wrap select-text">
                  {organizeResult}
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-white/[0.06] flex-shrink-0">
              <button
                onClick={() => setOrganizeResult(null)}
                className="px-3 py-1.5 rounded-lg text-[10px] text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleApplyOrganize}
                className="px-3 py-1.5 rounded-lg text-[10px] text-white/92 bg-fluent-blue/20 hover:bg-fluent-blue/30 transition-all"
              >
                <i className="fa-solid fa-check text-[9px] mr-1" />
                {t('note.aiOrganize.confirmReplace')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slash command menu */}
      {slashMenu && (
        <SlashCommandMenu
          x={slashMenu.x}
          y={slashMenu.y}
          commands={SLASH_COMMANDS}
          onSelect={handleSlashCommand}
          onClose={() => setSlashMenu(null)}
        />
      )}

      {/* AI autocomplete ghost hint */}
      {aiAutocomplete && aiAutocomplete.loading && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] text-fluent-blue/60 bg-fluent-blue/[0.06] border border-fluent-blue/10">
          <i className="fa-solid fa-spinner fa-spin text-[7px]" />
          AI 续写中...
        </div>
      )}
      {aiAutocomplete && !aiAutocomplete.loading && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] text-white/50 bg-black/40 backdrop-blur-sm border border-white/[0.06]">
          <span className="truncate max-w-[200px]">{aiAutocomplete.text.slice(0, 60)}</span>
          <span className="text-white/30">Tab 接受</span>
          <span className="text-white/30">Esc 取消</span>
        </div>
      )}

      {/* Image context menu */}
      {img.imgCtxMenu && (
        <ContextMenu
          x={img.imgCtxMenu.x}
          y={img.imgCtxMenu.y}
          items={img.getImageMenuItems()}
          onClose={() => img.setImgCtxMenu(null)}
        />
      )}

      {/* Image resize popup */}
      {img.resizing && img.resizeTargetRef.current && (
        <div className="fixed inset-0 z-50" onMouseDown={() => img.commitResize()}>
          <div
            className="fixed z-50 rounded-xl border shadow-2xl p-3 min-w-[200px]"
            style={{
              ...img.getResizePos(img.resizeTargetRef.current),
              background: 'var(--panel-bg-solid, rgba(28,28,38,0.98))',
              borderColor: 'var(--border-color, rgba(255,255,255,0.08))',
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="text-[9px] text-white/60 mb-2">{t('note.imageWidth')}</div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="range" min={10} max={200} value={img.resizeWidth}
                onChange={e => img.handleResizeSlider(Number(e.target.value))}
                className="flex-1 h-1 accent-fluent-blue cursor-pointer"
              />
              <span className="text-[10px] text-white/80 w-[34px] text-right tabular-nums">
                {img.resizeWidth}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              {[30, 50, 80, 100, 150, 200].map(pct => (
                <button
                  key={pct}
                  onClick={() => img.handleResizeSlider(pct)}
                  className={`px-2 py-0.5 rounded text-[9px] transition-all ${
                    img.resizeWidth === pct
                      ? 'bg-fluent-blue/20 text-fluent-blue/80'
                      : 'text-white/55 hover:text-white/70 hover:bg-white/[0.06]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected image overlay + drag handle */}
      {img.selectedImg && img.selectedImg.isConnected && !img.resizing && (() => {
        const rect = img.selectedImg.getBoundingClientRect()
        return (
          <>
            {/* Selection border */}
            <div className="fixed z-40 pointer-events-none" style={{
              left: rect.left - 2, top: rect.top - 2,
              width: rect.width + 4, height: rect.height + 4,
              border: '1.5px solid rgba(96,165,250,0.5)',
              borderRadius: '3px',
            }} />
            {/* Drag handle at bottom-right */}
            <div
              className="fixed z-40 flex items-center justify-center cursor-se-resize"
              onMouseDown={img.handleDragResizeStart}
              style={{
                left: rect.right - 7, top: rect.bottom - 7,
                width: 14, height: 14,
                background: 'rgba(96,165,250,0.85)',
                borderRadius: '2px',
              }}
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M8 0v8H0" stroke="white" strokeWidth="1.5" />
              </svg>
            </div>
          </>
        )
      })()}

      {/* Lightbox */}
      {img.lightboxSrc && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onMouseDown={() => img.setLightboxSrc(null)}
        >
          <button
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-white/70 hover:text-white transition-all z-10"
            onClick={() => img.setLightboxSrc(null)}
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
          <img
            src={img.lightboxSrc}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl select-none"
            style={{ background: 'rgba(0,0,0,0.3)' }}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => img.setLightboxSrc(null)}
          />
        </div>
      )}

      {/* Content: edit + preview panes */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Suggestion bubble —?shown when idle detection triggers */}
        {showSuggestion && !organizing && (
          <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 px-3 py-1.5 bg-fluent-blue/8 border-b border-fluent-blue/15 backdrop-blur-sm">
            <i className="fa-solid fa-lightbulb text-[9px] text-amber-400/70" />
            <span className="flex-1 text-[9px] text-white/70">{suggestionText}</span>
            <button
              onClick={handleSuggestOrganize}
              className="px-2 py-0.5 rounded text-[8px] text-white/90 bg-fluent-blue/20 hover:bg-fluent-blue/30 transition-all"
            >
              <i className="fa-solid fa-broom text-[7px] mr-1" />
              {t('note.aiOrganize.organize')}
            </button>
            <button
              onClick={handleDismissSuggestion}
              className="w-4 h-4 flex items-center justify-center rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all"
            >
              <i className="fa-solid fa-xmark text-[7px]" />
            </button>
          </div>
        )}

        {showEdit && (
          <div className={`flex-1 min-w-0 flex flex-col ${viewMode === 'split' ? 'border-r border-white/[0.04]' : ''}`}>
            {isMarkdown ? (
              <textarea
                value={mdContent}
                onChange={e => handleMdChange(e.target.value)}
                placeholder={t('note.markdownPlaceholder')}
                className="flex-1 bg-transparent text-[10px] text-white/85 outline-none resize-none px-3 py-1.5 placeholder:text-white/25 leading-relaxed font-mono"
              />
            ) : (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleContentInput}
                onKeyDown={handleEditorKeyDown}
                onMouseDown={img.handleEditorMouseDown}
                onDoubleClick={img.handleImageDoubleClick}
                onPaste={handlePaste}
                className="flex-1 overflow-y-auto text-[10px] text-white/85 outline-none px-3 py-1.5 leading-relaxed min-h-[60px] [&_.image-caption]:text-[9px] [&_.image-caption]:text-white/50 [&_.image-caption]:text-center [&_.image-caption]:italic"
              />
            )}
          </div>
        )}
        {showPreview && (
          <div className="flex-1 min-w-0 overflow-y-auto px-3 py-1.5">
            <Suspense fallback={<div className="text-white/30 text-[10px]">...</div>}>
              <MdPreview
                content={isMarkdown ? mdContent : stripHtml(note.content || '')}
                isHtml={!isMarkdown}
                className="text-[10px] text-white/85 [&_*]:!text-inherit"
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  )
}

export default NoteEditor
