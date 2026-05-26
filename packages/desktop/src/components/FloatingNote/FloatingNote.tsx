import React, { useRef, useState, useEffect, useCallback, useMemo, useLayoutEffect, Suspense } from 'react'
import { motion } from 'framer-motion'
import { FloatingNote as FN } from '../../types'
import { useStore } from '../../store/useStore'
import { countText, stripHtml } from '../../utils/helpers'
import ContextMenu from '../Common/ContextMenu'
import { onContentEdit, flushPendingEdit } from '../../store/contentEditTracker'
import type { EditorAction } from './AIChatPanel'
import type { AIAction } from '../../utils/ai/types'
import { sanitizeHtml } from '../../utils/sanitize'
import { resolveImageSrc } from '../../utils/imageStore'
import { useTranslation } from '../../i18n'
import { updateWikiLinksOnRename, resolveWikiLink, buildBacklinkIndex } from '../../utils/wikiLinks'
import { highlightInHtml } from '../../utils/searchContext'
import FloatingNoteHeader from './FloatingNoteHeader'
import FloatingNoteContent from './FloatingNoteContent'
import FloatingNoteOverlays from './FloatingNoteOverlays'
import { useNoteVisualStyle } from './useNoteVisualStyle'
import { getContextMenuItems } from './floatingNoteContextMenu'
import { extractTodosFromContent, addNoteTodo, toggleNoteTodo, deleteNoteTodo } from './floatingNoteTodos'
import { handleMouseDown, handleResizeStart } from './floatingNoteDrag'
import { useNoteWiki } from './useNoteWiki'
import { handleEditorKeyDown } from './floatingNoteKeyboard'
import { handlePaste, handleDrop } from './floatingNoteMedia'
import { handleTextSelectLogic, handleTextInputLogic, handleAIReplaceLogic, handleApplyActionLogic, handleViewModeChangeLogic, handleEditModeChangeLogic } from './floatingNoteEditor'
import { notePropsEqual } from './FloatingNote.utils'

const AIChatPanel = React.lazy(() => import('./AIChatPanel'))
const VersionHistoryPanelLazy = React.lazy(() => import('./VersionHistoryPanel'))
const ei = window.electronAPI as ElectronAPI | undefined

const isElectron = !!ei

interface Props { note: FN; standalone?: boolean; matched?: boolean; searchKeyword?: string }

const FloatingNote: React.FC<Props> = ({ note, standalone, matched, searchKeyword }) => {
  const focusNote = useStore(s => s.focusNote)
  const removeFloatingNote = useStore(s => s.removeFloatingNote)
  const updateFloatingNote = useStore(s => s.updateFloatingNote)
  const moveNote = useStore(s => s.moveNote)
  const backgroundMode = useStore(s => s.backgroundMode)
  const { t } = useTranslation()
  const [pos, setPos] = useState({ x: note.x, y: note.y })
  const [dragging, setDragging] = useState(false)

  // Sync local pos when note.x / note.y change externally
  useEffect(() => {
    setPos({ x: note.x, y: note.y })
  }, [note.x, note.y])
  const [todoText, setTodoText] = useState('')
  const noteOpacity = note.opacity ?? 1

  // Rich text state
  const editorRef = useRef<HTMLDivElement>(null)
  /** Tracks the last content string we have committed to the contentEditable DOM.
   *  When user types, handleTextInput updates this ref so the sync useLayoutEffect
   *  skips re-setting innerHTML (avoids cursor jumps).
   *  When content changes externally (undo/sync), the ref differs from note.content,
   *  so useLayoutEffect updates the DOM.
   */
  const committedContentRef = useRef('')
  const linkifyTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const savedRangeRef = useRef<Range | null>(null)
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [fmtToolbar, setFmtToolbar] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  const [linkToolbar, setLinkToolbar] = useState<{ x: number; y: number; visible: boolean; url: string; node: HTMLAnchorElement | null }>({ x: 0, y: 0, visible: false, url: '', node: null })
  const [aiToolbar, setAiToolbar] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' })
  const [wc, setWc] = useState({ count: 0, label: t('note.wordCountUnit') })
  const [showFormatBar, setShowFormatBar] = useState(true)
  const [showBacklinks, setShowBacklinks] = useState(false)
  const [showChatPanel, setShowChatPanel] = useState(false)

  // Fullscreen state & handler
  const [fullscreen, setFullscreen] = useState(false)
  const noteRef = useRef<HTMLDivElement>(null)

  // View mode & edit mode
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>(note.contentViewMode || 'edit')
  const [editMode, setEditMode] = useState<'richtext' | 'markdown'>(note.editMode || 'richtext')
  const [mdContent, setMdContent] = useState('')

  // Init mdContent from note content when switching to markdown mode
  useEffect(() => {
    if (editMode === 'markdown') {
      setMdContent(prev => prev || stripHtml(note.content || ''))
    }
  }, [editMode, note.content])

  const handleFullscreenToggle = useCallback(() => {
    if (standalone && isElectron) {
      // Electron standalone: fullscreen the BrowserWindow via IPC
      ei.fullscreen()
    } else if (noteRef.current) {
      // Browser mode: use Fullscreen API on the note element
      if (!document.fullscreenElement) {
        noteRef.current.requestFullscreen?.()
      } else {
        document.exitFullscreen?.()
      }
    }
  }, [standalone])

  // Sync fullscreen state from Fullscreen API events
  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [ctxImage, setCtxImage] = useState<string | null>(null) // image src when ctxMenu is on an image
  const [resizingFN, setResizingFN] = useState(false)
  const [resizeWidthFN, setResizeWidthFN] = useState(100)
  const resizeTargetRefFN = useRef<HTMLImageElement | null>(null)
  const [lightboxSrcFN, setLightboxSrcFN] = useState<string | null>(null)
  // Image click selection for drag resize
  const selectedImgRefFN = useRef<HTMLImageElement | null>(null)
  const dragStateRefFN = useRef<{ startX: number; startW: number } | null>(null)
  const [selectedImgFN, setSelectedImgFN] = useState<HTMLImageElement | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const folders = useStore(s => s.folders)
  const moveNoteToFolder = useStore(s => s.moveNoteToFolder)

  const nd = isElectron && standalone ? ({ WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties) : undefined

  /**
   * Sync contentEditable DOM when content changes externally.
   * Uses committedContentRef to avoid re-setting innerHTML when the user
   * is typing (handleTextInput already updated the DOM and the ref).
   */
  const assetsResolvedRef = useRef(false)

  useLayoutEffect(() => {
    const el = editorRef.current
    if (!el || note.type !== 'text') return
    const storeContent = note.content || ''
    if (committedContentRef.current !== storeContent) {
      el.innerHTML = sanitizeHtml(storeContent)
      committedContentRef.current = storeContent
      setWc(countText(el.textContent || ''))

      // Resolve assets:// URLs once per note load
      if (!assetsResolvedRef.current && storeContent.includes('assets://')) {
        assetsResolvedRef.current = true
        const mediaEls = Array.from(el.querySelectorAll('img, video')).filter(
          m => m.getAttribute('src')?.startsWith('assets://')
        )
        if (mediaEls.length > 0) {
          Promise.all(mediaEls.map(async (media) => {
            const src = media.getAttribute('src') || ''
            const resolved = await resolveImageSrc(src)
            if (resolved !== src) media.setAttribute('src', resolved)
          })).catch((err: unknown) => {
            console.error('[media] resolve image src failed:', err)
          })
        }
      }
    }
  }, [note.content, note.type])

  // Save editor selection range when AI chat panel opens, so Apply can restore it
  useEffect(() => {
    if (showChatPanel) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange()
      }
    } else {
      savedRangeRef.current = null
    }
  }, [showChatPanel])

  // ── Search keyword highlight ────────────────────────────────────────
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || editMode === 'markdown' || note.type !== 'text') return

    if (searchKeyword && !note.locked && !note.archived) {
      const kw = searchKeyword
      if (!kw.trim()) return

      // Strip any existing highlight marks from the DOM first, so the
      // guard below works correctly when the keyword changes (not just clears)
      const oldMarks = editor.querySelectorAll('mark.search-highlight')
      for (const m of oldMarks) {
        const parent = m.parentNode
        if (parent) {
          parent.replaceChild(document.createTextNode(m.textContent || ''), m)
          parent.normalize()
        }
      }

      const cleanContent = note.content || ''
      // Only apply if the editor hasn't been modified by the user
      if (editor.innerHTML === cleanContent) {
        const highlighted = highlightInHtml(cleanContent, kw)
        if (highlighted !== cleanContent) {
          editor.innerHTML = sanitizeHtml(highlighted)
          // Scroll to first highlight
          requestAnimationFrame(() => {
            const mark = editor.querySelector('mark.search-highlight') as HTMLElement
            if (mark) {
              mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          })
        }
      }
    } else if (!searchKeyword) {
      // Clean up highlight marks when keyword is cleared
      const marks = editor.querySelectorAll('mark.search-highlight')
      if (marks.length > 0) {
        for (const m of marks) {
          const parent = m.parentNode
          if (parent) {
            parent.replaceChild(document.createTextNode(m.textContent || ''), m)
            parent.normalize()
          }
        }
      }
    }
  }, [searchKeyword, note.content, note.id, editMode, note.type, note.locked, note.archived])

  // Restore alwaysOnTop when Electron standalone mounts
  useEffect(() => {
    if (!standalone || !isElectron) return
    if (note.pinned) ei.alwaysOnTop(true)
  }, [standalone, note.pinned])

  // Lock: disable window resizing + pass mouse events through content area
  // in standalone mode. main.cjs polls cursor position to keep title bar
  // (top 44px) interactive —?unlock/close/minimize buttons still work.
  useEffect(() => {
    if (!standalone || !isElectron) return
    ei.setResizable(!note.locked)
    ei.ignoreMouseEvents({ ignore: !!note.locked })
  }, [standalone, note.locked, isElectron])

  // Fullscreen escape handler
  useEffect(() => {
    if (!fullscreen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [fullscreen])

  // Close toolbar when selection is cleared globally
  useEffect(() => {
    if (!fmtToolbar.visible) return
    const handler = () => {
      const sel = window.getSelection()
      if (!sel || !sel.toString().trim()) {
        setFmtToolbar(prev => ({ ...prev, visible: false }))
      }
    }
    document.addEventListener('mouseup', handler)
    return () => document.removeEventListener('mouseup', handler)
  }, [fmtToolbar.visible])

  // Cleanup linkify debounce, edit tracker, drag listeners, and all tracked timeouts on unmount
  const cleanupDragRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    return () => {
      flushPendingEdit()
      cleanupDragRef.current?.()
      if (linkifyTimerRef.current) clearTimeout(linkifyTimerRef.current)
      for (const t of timeoutIdsRef.current) clearTimeout(t)
      timeoutIdsRef.current = []
    }
  }, [])

  const { navigateToRef, getCachedFuse, linkifyEditor } = useNoteWiki()

  const onMouseDown = (e: React.MouseEvent) => {
    handleMouseDown(e, note, standalone, pos, focusNote, moveNote, setDragging, setPos, cleanupDragRef)
  }

  const onResizeStart = (e: React.MouseEvent) => {
    handleResizeStart(e, note, standalone, updateFloatingNote, cleanupDragRef)
  }

  // -- Rich text handlers --

  const handleTextSelect = useCallback(() => {
    handleTextSelectLogic(editorRef, showFormatBar, note.collapsed, { setFmtToolbar, setLinkToolbar, setAiToolbar })
  }, [showFormatBar, note.collapsed])

  const handleTextareaSelect = useCallback((text: string, rect: DOMRect | null) => {
    if (text.trim().length >= 10 && rect) {
      setAiToolbar({ x: rect.left + rect.width / 2, y: rect.top + 28, visible: true, text: text.trim() })
    } else {
      setAiToolbar(prev => ({ ...prev, visible: false, text: '' }))
    }
  }, [])

  const handleTextInput = useCallback(() => {
    handleTextInputLogic(editorRef, committedContentRef, linkifyTimerRef, linkifyEditor, note.id, updateFloatingNote, setWc)
  }, [note.id, updateFloatingNote, linkifyEditor])

  const handleAIReplace = useCallback((newText: string, action: AIAction) => {
    handleAIReplaceLogic(editorRef, setAiToolbar, newText, action)
  }, [])

  const handleApplyAction = useCallback((action: EditorAction) => {
    handleApplyActionLogic(editorRef, savedRangeRef, note.id, updateFloatingNote, action)
  }, [note.id, updateFloatingNote])

  const handleViewModeChange = useCallback((mode: 'edit' | 'preview' | 'split') => {
    handleViewModeChangeLogic(mode, setViewMode, note.id, updateFloatingNote)
  }, [note.id, updateFloatingNote])

  const handleEditModeChange = useCallback((mode: 'richtext' | 'markdown') => {
    handleEditModeChangeLogic(mode, setEditMode, note.id, updateFloatingNote)
  }, [note.id, updateFloatingNote])

  const handleRevertVersion = useCallback((version: import('../../utils/noteHistory').VersionEntry) => {
    updateFloatingNote(note.id, {
      title: version.title,
      content: version.content,
      todos: version.todos as FN['todos'],
    })
    setShowVersionHistory(false)
  }, [note.id, updateFloatingNote])

  const handleTitleSave = useCallback((newTitle: string) => {
    const oldTitle = note.title
    if (newTitle === oldTitle) return
    updateFloatingNote(note.id, { title: newTitle })
    // Propagate rename to all wiki links
    const allNotes = useStore.getState().floatingNotes.map(n => ({
      id: n.id, title: n.title, content: n.content || '', todos: n.todos,
    }))
    const patches = updateWikiLinksOnRename(oldTitle, newTitle, allNotes)
    for (const p of patches) {
      updateFloatingNote(p.noteId, { content: p.content, todos: p.todos as FN['todos'] })
    }
    if (patches.length > 0) {
      const msg = t('note.refsUpdated', { count: patches.length })
      // Show brief toast
      const div = document.createElement('div')
      div.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[99999] border border-white/[0.08] rounded-xl px-4 py-2 shadow-2xl text-xs text-white/72 backdrop-blur-xl'
      div.style.background = 'var(--panel-bg-solid)'
      div.textContent = msg
      document.body.appendChild(div)
      setTimeout(() => div.remove(), 3000)
    }
  }, [note.title, note.id, updateFloatingNote])


  // Compute backlinks for this note
  const allNotesData = useStore(s => s.floatingNotes)
  const backlinks = useMemo(() => {
    const notesWithContent = allNotesData.map(n => ({
      id: n.id, title: n.title, content: n.content || '', todos: n.todos,
    }))
    const index = buildBacklinkIndex(notesWithContent)
    const sourceIds = index.get(note.id) || []
    return sourceIds.map(id => allNotesData.find(n => n.id === id)).filter(Boolean) as typeof allNotesData
  }, [allNotesData, note.id])



  const onPaste = useCallback((e: React.ClipboardEvent) => {
    handlePaste(e, note.id, editorRef, updateFloatingNote, onContentEdit)
  }, [note.id, updateFloatingNote, onContentEdit, editorRef])

  const onDropHandler = useCallback((e: React.DragEvent) => {
    handleDrop(e, note.id, !!note.locked, !!note.archived, editorRef, updateFloatingNote, onContentEdit)
  }, [note.id, note.locked, note.archived, updateFloatingNote, onContentEdit, editorRef])

  // ── Image click selection + drag resize ──
  const handleEditorMouseDownFN = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && editorRef.current?.contains(target)) {
      selectedImgRefFN.current = target as HTMLImageElement
      setSelectedImgFN(target as HTMLImageElement)
    } else if (selectedImgRefFN.current) {
      selectedImgRefFN.current = null
      setSelectedImgFN(null)
    }
  }, [])

  const handleDragResizeStartFN = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const img = selectedImgRefFN.current
    if (!img || note.locked) return
    dragStateRefFN.current = { startX: e.clientX, startW: img.width }

    const onMove = (ev: MouseEvent) => {
      const ds = dragStateRefFN.current
      if (!ds) return
      const delta = ev.clientX - ds.startX
      img.style.width = `${Math.max(50, ds.startW + delta)}px`
    }
    const onUp = () => {
      dragStateRefFN.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      onContentEdit(note.id)
      updateFloatingNote(note.id, { content: editorRef.current?.innerHTML || '' })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [note.id, note.locked, updateFloatingNote])

  const handleImageDblClickFN = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'IMG' && editorRef.current?.contains(target)) {
      e.preventDefault()
      setLightboxSrcFN((target as HTMLImageElement).getAttribute('src') || '')
    }
  }, [])

  const onEditorKeyDown = useCallback(handleEditorKeyDown, [])

  // -- Native context menu listener for images in contentEditable --
  // React synthetic onContextMenu doesn't fire reliably for elements
  // inside contentEditable with imperatively set innerHTML content.
  useEffect(() => {
    const el = editorRef.current
    if (!el || editMode !== 'richtext' || note.type !== 'text') return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' && el.contains(target)) {
        e.preventDefault()
        e.stopPropagation()
        const src = target.getAttribute('src') || ''
        setCtxImage(src)
        setCtxMenu({ x: e.clientX, y: e.clientY })
      }
    }
    el.addEventListener('contextmenu', handler)
    return () => el.removeEventListener('contextmenu', handler)
  }, [editMode, note.type])

  // -- Context menu (synthetic, for non-image right-clicks on outer elements) --

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
    setCtxImage(null)
  }

  const getContextMenuItemsMemo = useCallback(
    () => getContextMenuItems({
      ctxImage, t, note, editorRef, resizeTargetRefFN,
      setResizingFN, setResizeWidthFN, updateFloatingNote, removeFloatingNote,
      onMoveToFolder: () => setShowFolderPicker(true),
      folders,
    }),
    [ctxImage, t, note, editorRef, resizeTargetRefFN, setResizingFN, setResizeWidthFN, updateFloatingNote, removeFloatingNote, folders],
  )

  // -- Todo handlers --

  const onExtractTodos = useCallback(
    () => extractTodosFromContent(note.content, note.todos, note.id, updateFloatingNote),
    [note.content, note.todos, note.id, updateFloatingNote],
  )

  const onAddNoteTodo = useCallback(
    () => addNoteTodo(note.locked, todoText, note.todos, note.id, updateFloatingNote, setTodoText),
    [note.locked, todoText, note.todos, note.id, updateFloatingNote],
  )

  const onToggleNoteTodo = useCallback(
    (todoId: string) => toggleNoteTodo(todoId, note.locked, note.todos, note.id, updateFloatingNote, t),
    [note.locked, note.todos, note.id, updateFloatingNote, t],
  )

  const onDeleteNoteTodo = useCallback(
    (todoId: string) => deleteNoteTodo(todoId, note.locked, note.todos, note.id, updateFloatingNote, t),
    [note.locked, note.todos, note.id, updateFloatingNote, t],
  )

  // Render todo text with URL/wiki link detection
  const renderTodoText = (text: string) => {
    if (!text) return text || ''
    const parts = text.split(/(https?:\/\/[^\s]+|便签:\/\/[a-zA-Z0-9_-]+|\[\[[^\]|]+?(?:\|[^\]]+)?\]\])/g)
    if (parts.length === 1) return text

    const allNotes = useStore.getState().floatingNotes
    const noteStubs = allNotes.map(n => ({ id: n.id, title: n.title }))
    const fuse = getCachedFuse()

    return parts.map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-fluent-blue underline" title={t('note.openLink')}>{part}</a>
      }
      if (/^便签:\/\//.test(part)) {
        const refId = part.replace('便签://', '')
        return <a key={i} href={`#ref-${refId}`}
          className="text-purple-400 underline" title={t('note.jumpToRef')}
          onClick={(e) => { e.preventDefault(); navigateToRef(refId) }}>{part}</a>
      }
      // [[wiki link]]
      if (/^\[\[/.test(part)) {
        const inner = part.slice(2, -2)
        const pipeIdx = inner.indexOf('|')
        const linkTitle = (pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner).trim()
        const displayText = (pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : inner).trim()
        const resolved = resolveWikiLink(linkTitle, noteStubs, fuse)
        if (resolved) {
          return <a key={i} href={`#ref-${resolved.id}`}
            className="text-purple-400 underline" title={t('note.jumpToRef')}
            onClick={(e) => { e.preventDefault(); navigateToRef(resolved.id) }}>{displayText}</a>
        }
        return <span key={i} className="text-red-400 underline decoration-dashed" title={t('note.linkNotFound', { title: linkTitle })}>{displayText}</span>
      }
      return part
    })
  }

  // -- Visual constants --

  const visualStyle = useNoteVisualStyle(backgroundMode, note.color, note.pinned, note.locked, noteOpacity)

  const { bgColor, backdropFilter, noteBorder, noteBoxShadow } = visualStyle

  const highlightStyle = matched
    ? { boxShadow: '0 0 20px rgba(96,165,250,0.15), 0 0 0 1px rgba(96,165,250,0.15)' }
    : undefined

  // Archived styling
  const isArchived = note.archived

  const handleRemoveNote = useCallback(() => {
    if (note.locked) return
    // Minimize instead of delete — note stays in floatingNotes with floated: false
    // so it appears in the main window's notes/todo list
    updateFloatingNote(note.id, { floated: false })
  }, [note, updateFloatingNote])

  // -- Fullscreen style --

  const fsStyle = fullscreen
    ? {
        position: 'fixed' as const,
        left: 0, top: 0,
        width: '100vw', height: '100dvh',
        zIndex: 99998,
      }
    : undefined

  // -- Word count text --

  const wcText = `${wc.count}${wc.label}`

  return (
    <>
      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-[99997] bg-black/50 backdrop-blur-sm" onClick={() => setFullscreen(false)} />
      )}

      <motion.div
        initial={{ opacity: 0, scale: standalone ? 1 : 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: standalone ? 1 : 0.9 }}
        transition={{ duration: 0.2 }}
        className={standalone
          ? 'fixed inset-0 w-screen h-screen overflow-hidden flex flex-col'
          : 'absolute rounded-xl overflow-hidden flex flex-col'
        }
        data-note-id={note.id}
        ref={noteRef}
        style={{
          ...fsStyle,
          zIndex: standalone ? undefined : note.zIndex,
          left: standalone ? undefined : pos.x,
          top: standalone ? undefined : pos.y,
          width: standalone ? '100%' : note.width,
          height: standalone ? '100vh' : note.height,
          background: bgColor,
          backdropFilter,
          border: standalone ? 'none' : noteBorder,
          boxShadow: standalone ? 'none' : (highlightStyle?.boxShadow || noteBoxShadow),
          cursor: standalone ? 'default' : (note.locked ? 'default' : dragging ? 'grabbing' : 'default'),
          opacity: isArchived ? 0.6 : 1,
          pointerEvents: 'auto',
        }}
        onContextMenu={handleContextMenu}
      >
        <FloatingNoteHeader
          note={note}
          standalone={standalone}
          fullscreen={fullscreen}
          noteOpacity={noteOpacity}
          handleMouseDown={onMouseDown}
          handleFullscreenToggle={handleFullscreenToggle}
          handleTitleSave={handleTitleSave}
          onRemove={handleRemoveNote}
          editorRef={editorRef}
          timeoutIdsRef={timeoutIdsRef}
        />

        <FloatingNoteContent
          note={note}
          isArchived={isArchived}
          nd={nd}
          editorRef={editorRef}
          fmtToolbar={fmtToolbar}
          aiToolbar={aiToolbar}
          linkToolbar={linkToolbar}
          wc={wc}
          wcText={wcText}
          showFormatBar={showFormatBar}
          viewMode={viewMode}
          editMode={editMode}
          mdContent={mdContent}
          backlinks={backlinks}
          showBacklinks={showBacklinks}
          todoText={todoText}
          onFmtToolbarChange={setFmtToolbar}
          onAiToolbarChange={setAiToolbar}
          onLinkToolbarChange={setLinkToolbar}
          onShowFormatBarChange={setShowFormatBar}
          onViewModeChange={handleViewModeChange}
          onEditModeChange={handleEditModeChange}
          onMdContentChange={setMdContent}
          onShowBacklinksChange={setShowBacklinks}
          onShowChatPanelChange={setShowChatPanel}
          onTodoTextChange={setTodoText}
          onExtractTodos={onExtractTodos}
          onAddTodo={onAddNoteTodo}
          onToggleTodo={onToggleNoteTodo}
          onDeleteTodo={onDeleteNoteTodo}
          onRenderTodoText={renderTodoText}
          onTextInput={handleTextInput}
          onTextSelect={handleTextSelect}
          onTextareaSelect={handleTextareaSelect}
          onPaste={onPaste}
          onDrop={onDropHandler}
          onEditorMouseDown={handleEditorMouseDownFN}
          onImageDblClick={handleImageDblClickFN}
          onKeyDown={onEditorKeyDown}
          onAIReplace={handleAIReplace}
        />

        {/* Resize handle - hidden when archived */}
        {!standalone && !note.locked && !note.collapsed && !isArchived && (
          <div onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex-shrink-0 z-10 flex items-end justify-end">
            <svg className="w-3 h-3 text-white/[0.12] mb-0.5 mr-0.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M10 0v10H0" />
            </svg>
          </div>
        )}

      </motion.div>

      {/* Context menu —?outside motion.div to avoid overflow-hidden clipping */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getContextMenuItemsMemo()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <FloatingNoteOverlays
        noteId={note.id}
        resizingFN={resizingFN}
        resizeWidthFN={resizeWidthFN}
        resizeTargetRefFN={resizeTargetRefFN}
        selectedImgFN={selectedImgFN}
        lightboxSrcFN={lightboxSrcFN}
        editorRef={editorRef}
        onSetResizingFN={setResizingFN}
        onSetResizeWidthFN={setResizeWidthFN}
        onSetLightboxSrcFN={setLightboxSrcFN}
        onDragResizeStart={handleDragResizeStartFN}
        t={t}
      />

      {/* Version history panel */}
      {showVersionHistory && (
        <Suspense fallback={null}><VersionHistoryPanelLazy
          note={note}
          onClose={() => setShowVersionHistory(false)}
          onRevert={handleRevertVersion}
        /></Suspense>
      )}

      {/* Folder picker overlay */}
      {showFolderPicker && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center"
          onClick={() => setShowFolderPicker(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative w-56 max-h-64 overflow-y-auto rounded-xl border shadow-2xl p-1.5"
            style={{ background: 'var(--panel-bg-solid)', borderColor: 'var(--panel-border-accent)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-medium px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('folder.moveToFolder')}
            </div>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06] text-left"
              style={{ color: 'var(--text-primary)' }}
              onClick={() => {
                moveNoteToFolder(note.id, 'default')
                setShowFolderPicker(false)
              }}
            >
              <i className="fa-regular fa-folder text-[10px]" />
              {t('folder.allNotes')}
            </button>
            {folders.filter(f => f.id !== 'default').map(f => (
              <button
                key={f.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06] text-left"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => {
                  moveNoteToFolder(note.id, f.id)
                  setShowFolderPicker(false)
                }}
              >
                <i className="fa-regular fa-folder text-[10px]" />
                {f.name}
              </button>
            ))}
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06] text-left"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => {
                moveNoteToFolder(note.id, null)
                setShowFolderPicker(false)
              }}
            >
              <i className="fa-regular fa-folder-minus text-[10px]" />
              {t('folder.noFolder')}
            </button>
          </div>
        </div>
      )}

      {/* AI Chat panel —?overlays inside the note content area */}
      {showChatPanel && (
        <Suspense fallback={null}><AIChatPanel
          noteId={note.id}
          noteContent={note.content || ''}
          noteTitle={note.title}
          initialX={note.x + 8}
          initialY={note.y + 38}
          editorSelectedText={aiToolbar.text}
          onApplyAction={handleApplyAction}
          onClose={() => setShowChatPanel(false)}
        /></Suspense>
      )}
    </>
  )
}

export default React.memo(FloatingNote, notePropsEqual)
