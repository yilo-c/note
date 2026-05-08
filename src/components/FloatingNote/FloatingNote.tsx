import React, { useRef, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FloatingNote as FN } from '../../types'
import { useStore } from '../../store/useStore'
import { uid, formatRelativeTime, countText, stripHtml, COLOR_PRESETS, hexToRgb } from '../../utils/helpers'
import ContextMenu, { MenuItem } from '../Common/ContextMenu'
import FormatToolbar from './FormatToolbar'
import AIToolbar from './AIToolbar'

const ei = (window as any).electronAPI

const isElectron = !!ei

interface Props { note: FN; standalone?: boolean; matched?: boolean }

const TAG_COLORS = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee', '#818cf8', '#e879f9']

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

const FloatingNote: React.FC<Props> = ({ note, standalone, matched }) => {
  const { focusNote, removeFloatingNote, updateFloatingNote, moveNote } = useStore()
  const [pos, setPos] = useState({ x: note.x, y: note.y })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 })

  // Sync local pos when note.x / note.y change externally
  useEffect(() => {
    setPos({ x: note.x, y: note.y })
  }, [note.x, note.y])
  const [todoText, setTodoText] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const noteOpacity = note.opacity ?? 1

  // Tag edit state
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [tagInput, setTagInput] = useState('')

  // More menu
  const [showMore, setShowMore] = useState(false)
  const [moreUp, setMoreUp] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  // Rich text state
  const editorRef = useRef<HTMLDivElement>(null)
  const linkifyTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [fmtToolbar, setFmtToolbar] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  const [aiToolbar, setAiToolbar] = useState<{ x: number; y: number; visible: boolean; text: string }>({ x: 0, y: 0, visible: false, text: '' })
  const [wc, setWc] = useState({ count: 0, label: '字' })

  // Fullscreen state & handler
  const [fullscreen, setFullscreen] = useState(false)
  const noteRef = useRef<HTMLDivElement>(null)

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
  const [refLinkCopied, setRefLinkCopied] = useState(false)

  const nd = isElectron && standalone ? ({ WebkitAppRegion: 'no-drag' as any } as React.CSSProperties) : undefined

  // Close more menu on outside click
  useEffect(() => {
    if (!showMore) return
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false)
        setShowTagEditor(false)
        setTagInput('')
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [showMore])

  // Reset menu direction when closed
  useEffect(() => { if (!showMore) setMoreUp(false) }, [showMore])

  // Initialize editor content once on mount
  useEffect(() => {
    const el = editorRef.current
    if (el && note.type === 'text') {
      el.innerHTML = note.content || ''
      updateWordCount(el.textContent || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore alwaysOnTop when Electron standalone mounts
  useEffect(() => {
    if (!standalone || !isElectron) return
    if (note.pinned) ei.alwaysOnTop(true)
  }, [])

  // Lock: disable window resizing in standalone mode
  useEffect(() => {
    if (!standalone || !isElectron) return
    ei.setResizable(!note.locked)
  }, [standalone, note.locked])

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

  const updateWordCount = (text: string) => {
    setWc(countText(text))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (standalone) return
    if (note.locked) return
    if (note.archived) return // Archived notes can't be dragged
    if ((e.target as HTMLElement).closest('.no-drag')) return
    if (e.button === 2) return
    focusNote(note.id)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      const nx = dragRef.current.origX + ev.clientX - dragRef.current.startX
      const ny = dragRef.current.origY + ev.clientY - dragRef.current.startY
      setPos({ x: nx, y: ny })
    }
    const onUp = (ev: MouseEvent) => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const fx = dragRef.current.origX + ev.clientX - dragRef.current.startX
      const fy = dragRef.current.origY + ev.clientY - dragRef.current.startY
      moveNote(note.id, fx, fy)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    if (standalone) return
    if (note.locked || note.archived) return
    e.stopPropagation()
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startW = note.width
    const startH = note.height

    const onMove = (ev: MouseEvent) => {
      updateFloatingNote(note.id, {
        width: Math.max(180, startW + ev.clientX - startX),
        height: Math.max(100, startH + ev.clientY - startY),
      })
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // -- Tag handlers --
  const handleAddTag = () => {
    const v = tagInput.trim()
    if (!v) return
    const existing = note.tags || []
    if (existing.includes(v)) return
    updateFloatingNote(note.id, { tags: [...existing, v] })
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    const existing = note.tags || []
    updateFloatingNote(note.id, { tags: existing.filter(t => t !== tag) })
  }

  // -- Rich text handlers --

  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !sel.toString().trim()) {
      setFmtToolbar(prev => ({ ...prev, visible: false }))
      setAiToolbar(prev => ({ ...prev, visible: false, text: '' }))
      return
    }
    const editor = editorRef.current
    if (!editor || !editor.contains(sel.anchorNode)) {
      setFmtToolbar(prev => ({ ...prev, visible: false }))
      setAiToolbar(prev => ({ ...prev, visible: false, text: '' }))
      return
    }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const text = sel.toString().trim()
    setFmtToolbar({ x: rect.left + rect.width / 2, y: rect.top, visible: true })
    // Show AI toolbar if text is long enough (>= 10 chars)
    if (text.length >= 10) {
      setAiToolbar({ x: rect.left + rect.width / 2, y: rect.top + 28, visible: true, text })
    } else {
      setAiToolbar(prev => ({ ...prev, visible: false, text: '' }))
    }
  }, [])

  const handleTextInput = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const html = el.innerHTML
    updateFloatingNote(note.id, { content: html })
    const text = el.textContent || ''
    updateWordCount(text)

    // Debounced URL linkification (avoids cursor jumps during active typing)
    if (linkifyTimerRef.current) clearTimeout(linkifyTimerRef.current)
    linkifyTimerRef.current = setTimeout(() => {
      linkifyEditor(el)
    }, 2000)
  }, [note.id, updateFloatingNote])

  const handleAIReplace = useCallback((newText: string) => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const editor = editorRef.current
    if (!editor || !editor.contains(sel.anchorNode)) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(newText))
    range.collapse(false)
    updateFloatingNote(note.id, { content: editor.innerHTML })
    setAiToolbar(prev => ({ ...prev, visible: false, text: '' }))
  }, [note.id, updateFloatingNote])

  const navigateToRef = useCallback((refId: string) => {
    const allNotes = useStore.getState().floatingNotes
    const target = allNotes.find(n => n.id === refId)
    if (target) {
      useStore.getState().focusNote(refId)
      // Highlight the referenced note temporarily by scrolling/focusing
      const el = document.querySelector(`[data-note-id="${refId}"]`) as HTMLElement
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.boxShadow = '0 0 20px rgba(96,165,250,0.4), 0 0 0 1px rgba(96,165,250,0.3)'
        setTimeout(() => {
          el.style.boxShadow = ''
        }, 2000)
      }
    }
  }, [])

  const linkifyEditor = (editor: HTMLElement) => {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null)
    const textNodes: Text[] = []
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      if (node.parentElement && !node.parentElement.closest('a')) {
        textNodes.push(node)
      }
    }

    let changed = false
    for (const node of textNodes) {
      const text = node.textContent || ''
      const combinedRegex = /(https?:\/\/[^\s]+)|(便签:\/\/[a-zA-Z0-9_-]+)/g
      if (!combinedRegex.test(text)) continue

      combinedRegex.lastIndex = 0
      const fragment = document.createDocumentFragment()
      let lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = combinedRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
        }
        if (match[1]) {
          // External URL
          const a = document.createElement('a')
          a.href = match[1]
          a.textContent = match[1]
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
          a.style.color = '#60a5fa'
          a.style.textDecoration = 'underline'
          fragment.appendChild(a)
        } else if (match[2]) {
          // Internal ref link: 便签://[id]
          const refId = match[2].replace('便签://', '')
          const a = document.createElement('a')
          a.href = `#ref-${refId}`
          a.textContent = match[2]
          a.style.color = '#a78bfa'
          a.style.textDecoration = 'underline'
          a.style.cursor = 'pointer'
          a.dataset.refId = refId
          a.addEventListener('click', (e) => {
            e.preventDefault()
            navigateToRef(refId)
          })
          fragment.appendChild(a)
        }
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
      }

      if (fragment.childNodes.length > 0) {
        const sel = window.getSelection()
        const savedRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null

        node.parentNode?.replaceChild(fragment, node)
        changed = true

        if (savedRange) {
          try {
            sel?.removeAllRanges()
            sel?.addRange(savedRange)
          } catch { /* ignore */ }
        }
      }
    }

    if (changed) {
      updateFloatingNote(note.id, { content: editor.innerHTML })
    }
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    if (html) {
      // DOM-based HTML sanitization — more robust than regex
      const allowedTags = new Set(['b', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'br', 'div', 'p', 'span'])
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const stripNode = (node: Node): Node | null => {
        if (node.nodeType === Node.TEXT_NODE) return node.cloneNode()
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement
          const tag = el.tagName.toLowerCase()
          if (!allowedTags.has(tag)) {
            // Strip tag but keep children as text
            const text = el.textContent || ''
            return document.createTextNode(text)
          }
          const clone = document.createElement(tag)
          // Only keep href on <a>, strip all attributes including event handlers
          if (tag === 'a' && el.getAttribute('href')) {
            const href = el.getAttribute('href')!
            if (/^https?:\/\//i.test(href) && !/javascript:/i.test(href)) {
              clone.setAttribute('href', href)
              clone.setAttribute('target', '_blank')
              clone.setAttribute('rel', 'noopener noreferrer')
            }
          }
          for (const child of Array.from(el.childNodes)) {
            const cleaned = stripNode(child)
            if (cleaned) clone.appendChild(cleaned)
          }
          return clone
        }
        return null
      }
      const fragment = document.createDocumentFragment()
      for (const child of Array.from(doc.body.childNodes)) {
        const cleaned = stripNode(child)
        if (cleaned) fragment.appendChild(cleaned)
      }
      const range = window.getSelection()?.getRangeAt(0)
      if (range) {
        range.deleteContents()
        range.insertNode(fragment)
        // Move cursor to end of inserted content
        range.collapse(false)
      }
    } else {
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
    }
  }, [])

  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertHTML', false, '    ')
    }
  }

  // -- Context menu --

  const handleContextMenu = (e: React.MouseEvent) => {
    if (standalone) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  const getContextMenuItems = (): MenuItem[] => [
    {
      label: '复制标题',
      icon: 'fa-copy',
      onClick: () => navigator.clipboard.writeText(note.title),
    },
    {
      label: '复制内容',
      icon: 'fa-copy',
      onClick: () => {
        const text = note.type === 'text'
          ? stripHtml(note.content)
          : (note.todos || []).map(t => `${t.done ? '[x]' : '[ ]'} ${t.text}`).join('\n')
        navigator.clipboard.writeText(text || '')
      },
    },
    {
      label: note.archived ? '取消归档' : '归档',
      icon: 'fa-box-archive',
      onClick: () => updateFloatingNote(note.id, { archived: !note.archived }),
    },
    {
      label: (note.refCount ?? 0) > 0 ? `删除便签 (有 ${note.refCount} 个引用)` : '删除便签',
      icon: 'fa-trash-can',
      danger: true,
      disabled: note.locked,
      onClick: () => {
        if (note.locked) return
        if ((note.refCount ?? 0) > 0) {
          if (!confirm(`此便签被 ${note.refCount} 个便签引用，确定要删除吗？`)) return
        }
        removeFloatingNote(note.id)
      },
    },
  ]

  // -- Todo handlers --

  const addNoteTodo = () => {
    if (note.locked) return
    const v = todoText.trim()
    if (!v) return
    const todos = [...(note.todos || []), { id: uid(), text: v, done: false, createdAt: Date.now() }]
    updateFloatingNote(note.id, { todos })
    setTodoText('')
  }

  const toggleNoteTodo = (todoId: string) => {
    if (note.locked) return
    const todos = (note.todos || []).map(t => t.id === todoId ? { ...t, done: !t.done } : t)
    updateFloatingNote(note.id, { todos })
  }

  const deleteNoteTodo = (todoId: string) => {
    if (note.locked) return
    const todos = (note.todos || []).filter(t => t.id !== todoId)
    updateFloatingNote(note.id, { todos })
  }

  // Render todo text with URL detection
  const renderTodoText = (text: string) => {
    const parts = text.split(/(https?:\/\/[^\s]+|便签:\/\/[a-zA-Z0-9_-]+)/g)
    if (parts.length === 1) return text
    return parts.map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-fluent-blue underline" title="点击打开链接">{part}</a>
      }
      if (/^便签:\/\//.test(part)) {
        const refId = part.replace('便签://', '')
        return <a key={i} href={`#ref-${refId}`}
          className="text-purple-400 underline" title="点击跳转到引用便签"
          onClick={(e) => { e.preventDefault(); navigateToRef(refId) }}>{part}</a>
      }
      return part
    })
  }

  // -- Visual constants --

  const baseAlpha = isElectron ? 0.65 : 0.78
  const bgAlpha = baseAlpha * noteOpacity
  // Blend with selected color when set (full card tinting)
  let bgColor: string
  if (note.color) {
    const rgb = hexToRgb(note.color)
    if (rgb) {
      const tint = 0.30 * noteOpacity
      const r = Math.round(24 + (rgb.r - 24) * tint)
      const g = Math.round(24 + (rgb.g - 24) * tint)
      const b = Math.round(34 + (rgb.b - 34) * tint)
      bgColor = `rgba(${r},${g},${b},${bgAlpha.toFixed(2)})`
    } else {
      bgColor = `rgba(24,24,34,${bgAlpha.toFixed(2)})`
    }
  } else {
    bgColor = `rgba(24,24,34,${bgAlpha.toFixed(2)})`
  }
  const highlightStyle = matched
    ? { boxShadow: '0 0 20px rgba(96,165,250,0.15), 0 0 0 1px rgba(96,165,250,0.15)' }
    : undefined

  // Archived styling
  const isArchived = note.archived

  // -- Timestamps --

  const timeInfo = note.createdAt
    ? { display: formatRelativeTime(note.createdAt), full: new Date(note.createdAt).toLocaleString('zh-CN') }
    : null
  const updateTimeInfo = note.updatedAt && note.updatedAt !== note.createdAt
    ? { display: formatRelativeTime(note.updatedAt), full: new Date(note.updatedAt).toLocaleString('zh-CN') }
    : null

  // -- Fullscreen style --

  const fsStyle = fullscreen
    ? {
        position: 'fixed' as const,
        left: 0, top: 0,
        width: '100vw', height: '100vh',
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
          backdropFilter: isElectron ? 'none' : 'blur(18px) saturate(1.2)',
          border: standalone ? 'none' : (
            note.pinned ? `1px solid ${note.color ? `${note.color}70` : 'rgba(96,165,250,0.2)'}` :
            note.locked ? `1px solid ${note.color ? `${note.color}70` : 'rgba(251,191,36,0.2)'}` :
            note.color ? `1px solid ${note.color}50` :
            '1px solid rgba(255,255,255,0.06)'
          ),
          boxShadow: standalone ? 'none' : (highlightStyle?.boxShadow || (
            note.pinned
              ? `0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px ${note.color ? `${note.color}30` : 'rgba(96,165,250,0.08)'}${note.color ? `, 0 0 25px ${note.color}18` : ''}`
              : note.locked
              ? `0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px ${note.color ? `${note.color}30` : 'rgba(251,191,36,0.08)'}${note.color ? `, 0 0 25px ${note.color}18` : ''}`
              : note.color
              ? `0 8px 40px rgba(0,0,0,0.35), 0 0 30px ${note.color}15`
              : '0 8px 40px rgba(0,0,0,0.35)'
          )),
          cursor: standalone ? 'default' : (note.locked ? 'default' : dragging ? 'grabbing' : 'default'),
          opacity: isArchived ? 0.6 : 1,
          pointerEvents: note.locked ? 'none' as const : undefined,
        }}
        onMouseDown={() => { if (!standalone) focusNote(note.id) }}
        onContextMenu={handleContextMenu}
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04] flex-shrink-0"
          style={standalone
            ? ({ WebkitAppRegion: (note.locked ? 'no-drag' : 'drag') as any, cursor: 'default' } as React.CSSProperties)
            : { cursor: note.locked ? 'default' : 'grab' }
          }
          onMouseDown={handleMouseDown}
        >
          {/* Left section: collapse + functional buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0" style={nd}>
            {/* Collapse */}
            <button onClick={() => { if (!note.locked) updateFloatingNote(note.id, { collapsed: !note.collapsed }) }}
              className="w-4 h-4 flex items-center justify-center text-white/55 hover:text-white/80 transition-all text-[8px] flex-shrink-0">
              <i className={`fa-solid ${note.collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}`} />
            </button>
            {/* Archive */}
            <button onClick={() => { if (!note.locked) updateFloatingNote(note.id, { archived: !note.archived }) }}
              className={`w-5 h-5 flex items-center justify-center rounded transition-all text-[9px] ${isArchived ? 'text-amber-400/60' : 'text-white/55 hover:text-white/72 hover:bg-white/[0.06]'}`}
              title={isArchived ? '取消归档' : '归档'}>
              <i className="fa-solid fa-box-archive" />
            </button>
            {/* Pin — Electron: sets OS alwaysOnTop */}
            <button onClick={() => { const np = !note.pinned; updateFloatingNote(note.id, { pinned: np, zIndex: np ? 999999 : note.zIndex }); focusNote(note.id); if (standalone && isElectron) ei.alwaysOnTop(np) }}
              style={note.locked ? { pointerEvents: 'auto' as const, position: 'relative' as const, zIndex: 1001 } : undefined}
              className={`w-5 h-5 flex items-center justify-center rounded transition-all text-[9px] ${note.pinned ? 'text-fluent-blue/60' : 'text-white/55 hover:text-white/72 hover:bg-white/[0.06]'}`}
              title={note.pinned ? '取消置顶' : '置顶'}>
              <i className="fa-solid fa-thumbtack" />
            </button>
            {/* Lock */}
            <button onClick={() => updateFloatingNote(note.id, { locked: !note.locked })}
              style={note.locked ? { pointerEvents: 'auto' as const, position: 'relative' as const, zIndex: 1000 } : undefined}
              className={`w-5 h-5 flex items-center justify-center rounded transition-all text-[9px] ${note.locked ? 'text-amber-400/60' : 'text-white/55 hover:text-white/72 hover:bg-white/[0.06]'}`}
              title={note.locked ? '点击取消锁定' : '锁定'}>
              <i className="fa-solid fa-lock" />
            </button>
            {/* Pop out (Electron browser mode) — float to OS window */}
            {!standalone && isElectron && (
              <button onClick={() => {
                if (note.locked) return
                updateFloatingNote(note.id, { floated: true })
                ei.createFloatingWindow({
                  id: note.id, screenX: note.x, screenY: note.y,
                  width: note.width, height: note.height,
                })
              }}
                className="w-5 h-5 flex items-center justify-center rounded transition-all text-[9px] text-white/55 hover:text-white/72 hover:bg-white/[0.06]"
                title="弹出窗口">
                <i className="fa-solid fa-up-right-and-down-left-from-center" />
              </button>
            )}
            {/* More menu (···) */}
            <div className="relative" ref={moreRef}>
              <button onClick={(e) => {
                if (!showMore) {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setMoreUp(false)
                }
                setShowMore(!showMore)
              }}
                className={`w-5 h-5 flex items-center justify-center rounded transition-all text-[9px] ${showMore ? 'text-fluent-blue/70' : 'text-white/55 hover:text-white/72 hover:bg-white/[0.06]'}`}
                title="更多">
                <i className="fa-solid fa-ellipsis-vertical" />
              </button>
              {showMore && (
                <div className={`absolute z-50 border rounded-xl py-1 shadow-xl min-w-[160px] ${moreUp ? 'bottom-full left-0 mb-1' : 'top-full left-0 mt-1'}`}
                  style={{ background: 'var(--tooltip-bg)', borderColor: 'var(--panel-border-accent)' }}>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`便签://${note.id}`)
                    setRefLinkCopied(true)
                    setTimeout(() => setRefLinkCopied(false), 2000)
                    setShowMore(false)
                  }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>
                    <i className={`fa-solid ${refLinkCopied ? 'fa-check' : 'fa-link'} w-3 text-center text-[9px]`} />
                    {refLinkCopied ? '已复制' : '复制引用链接'}
                  </button>
                  <button onClick={() => setShowTagEditor(!showTagEditor)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-tags w-3 text-center text-[9px]" />
                    管理标签
                  </button>
                  {showTagEditor && (
                    <div className="px-3 py-2 border-t border-white/[0.06]">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {(note.tags || []).map(tag => (
                          <span key={tag}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]"
                            style={{ background: `${hashColor(tag)}20`, color: hashColor(tag) }}>
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="hover:opacity-70"><i className="fa-solid fa-xmark" /></button>
                          </span>
                        ))}
                        {(note.tags || []).length === 0 && <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>暂无标签</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddTag() }}
                          placeholder="输入标签名"
                          className="flex-1 text-[10px] px-1.5 py-1 rounded outline-none border"
                          style={{ background: 'var(--input-bg)', borderColor: 'var(--panel-border)', color: 'var(--text-primary)' }} />
                        <button onClick={handleAddTag} className="text-[9px] px-1.5 py-1 rounded transition-colors"
                          style={{ color: 'var(--text-secondary)' }}><i className="fa-solid fa-plus" /></button>
                      </div>
                    </div>
                  )}
                  <button onClick={handleFullscreenToggle}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] transition-colors"
                    style={{ color: 'var(--text-secondary)' }}>
                    <i className={`fa-solid ${fullscreen ? 'fa-compress' : 'fa-expand'} w-3 text-center text-[9px]`} />
                    {fullscreen ? '退出全屏' : '全屏'}
                  </button>
                  <div className="px-3 py-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>透明度</span>
                      <input type="range" min="0.15" max="1" step="0.05"
                        value={noteOpacity}
                        onChange={e => { const v = parseFloat(e.target.value); updateFloatingNote(note.id, { opacity: v }) }}
                        className="flex-1 h-1 accent-fluent-blue cursor-pointer" />
                      <span className="text-[9px] text-right" style={{ color: 'var(--text-dim)', minWidth: 24 }}>{Math.round(noteOpacity * 100)}%</span>
                    </div>
                  </div>
                  <div className="px-3 py-2 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>颜色</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {COLOR_PRESETS.map(p => (
                        <button key={p.name}
                          onClick={() => updateFloatingNote(note.id, { color: p.color || undefined })}
                          className="w-4 h-4 rounded-full border border-white/[0.15] flex items-center justify-center transition-transform hover:scale-125"
                          style={{ background: p.color || 'transparent' }}
                          title={p.name}>
                          {!p.color ? <span className="w-2 h-0.5 bg-white/30 rounded-full" /> : null}
                          {note.color === p.color && <i className="fa-solid fa-check text-[6px] text-white/90" />}
                        </button>
                      ))}
                      <label className="w-4 h-4 rounded-full border border-dashed border-white/[0.25] flex items-center justify-center cursor-pointer hover:border-white/50 transition-colors"
                        title="自定义颜色">
                        <i className="fa-solid fa-plus text-[7px] text-white/50" />
                        <input type="color" value={note.color || '#3b82f6'}
                          onChange={e => updateFloatingNote(note.id, { color: e.target.value })}
                          className="absolute opacity-0 w-0 h-0" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Middle section: title */}
          <div className="flex-1 ml-1 min-w-0 flex items-center gap-2">
            {editingTitle ? (
              <input autoFocus defaultValue={note.title}
                onBlur={e => { updateFloatingNote(note.id, { title: e.target.value }); setEditingTitle(false) }}
                onKeyDown={e => { if (e.key === 'Enter') { updateFloatingNote(note.id, { title: (e.target as HTMLInputElement).value }); setEditingTitle(false) } }}
                className="bg-white/[0.06] text-xs text-white/92 px-2 py-0.5 rounded flex-1 outline-none border border-white/[0.06]"
                style={nd} />
            ) : (
              <span className="text-xs text-white/87 font-light truncate flex items-center gap-1.5" onDoubleClick={() => setEditingTitle(true)} style={nd}>
                {isArchived && <i className="fa-regular fa-box-archive text-[9px] text-white/40" />}
                {note.title}
                {(note.refCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-fluent-blue/60 bg-fluent-blue/[0.08] px-1 py-0.5 rounded" title="被引用次数">
                    <i className="fa-solid fa-link" />{note.refCount}
                  </span>
                )}
              </span>
            )}
            {note.tags && note.tags.length > 0 && !editingTitle && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {note.tags.map(tag => (
                  <span key={tag} className="w-1.5 h-1.5 rounded-full" style={{ background: hashColor(tag) }} title={tag} />
                ))}
              </div>
            )}
            {timeInfo && !editingTitle && !note.collapsed && (
              <span className="text-[9px] text-white/30 whitespace-nowrap flex-shrink-0"
                title={updateTimeInfo ? `创建: ${timeInfo.full}\n修改: ${updateTimeInfo.full}` : `创建: ${timeInfo.full}`}>
                {timeInfo.display}{updateTimeInfo && ` · ${updateTimeInfo.display}`}
              </span>
            )}
          </div>
          {/* Right section: window controls (Windows standard: right side) */}
          <div className="flex items-center gap-0.5 flex-shrink-0" style={nd}>
            {standalone && isElectron && (
              <>
                <button onClick={() => { if (!note.locked) ei.minimize() }}
                  className="w-5 h-5 flex items-center justify-center rounded text-white/65 hover:text-white/72 hover:bg-white/[0.06] transition-all text-[9px]">
                  <i className="fa-regular fa-window-minimize" />
                </button>
                <button onClick={() => { if (!note.locked) ei.close() }}
                  className="w-5 h-5 flex items-center justify-center rounded text-white/65 hover:text-red-400/60 hover:bg-white/[0.06] transition-all text-[9px]">
                  <i className="fa-solid fa-xmark" />
                </button>
              </>
            )}
            {!standalone && (
              <button onClick={() => { if (!note.locked) removeFloatingNote(note.id) }}
                className="w-5 h-5 flex items-center justify-center rounded text-white/55 hover:text-red-400/60 hover:bg-white/[0.06] text-[9px] transition-all">
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>

        {/* Archived banner */}
        {isArchived && !note.collapsed && (
          <div className="flex items-center justify-center py-1 border-b border-white/[0.04]" style={{ background: 'rgba(251,191,36,0.06)' }}>
            <span className="text-[9px] text-amber-400/60 flex items-center gap-1">
              <i className="fa-regular fa-box-archive" /> 已归档
            </span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col relative" style={nd}>
          <div className="flex-1 min-h-0" style={{
            display: note.collapsed ? 'none' : undefined,
            overflowY: 'auto',
          }}>
            {note.type === 'text' ? (
              <div className="w-full h-full flex flex-col">
                {/* Floating format toolbar */}
                <FormatToolbar
                  x={fmtToolbar.x}
                  y={fmtToolbar.y}
                  visible={fmtToolbar.visible && !aiToolbar.visible}
                  containerEl={editorRef.current || document.body}
                  onClose={() => setFmtToolbar(prev => ({ ...prev, visible: false }))}
                />
                {/* AI toolbar */}
                <AIToolbar
                  x={aiToolbar.x}
                  y={aiToolbar.y}
                  visible={aiToolbar.visible}
                  selectedText={aiToolbar.text}
                  containerEl={editorRef.current || document.body}
                  onClose={() => setAiToolbar(prev => ({ ...prev, visible: false, text: '' }))}
                  onReplace={handleAIReplace}
                />
                {/* Contenteditable editor */}
                <div
                  ref={editorRef}
                  contentEditable={!note.locked && !isArchived}
                  suppressContentEditableWarning
                  onInput={handleTextInput}
                  onMouseUp={handleTextSelect}
                  onKeyUp={handleTextSelect}
                  onPaste={handlePaste}
                  onKeyDown={handleEditorKeyDown}
                  className="flex-1 bg-transparent text-xs text-white/87 leading-relaxed px-3 py-2 outline-none overflow-auto
                    [&_a]:text-fluent-blue [&_a]:underline
                    [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]
                    break-words
                    [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                    [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
                    [&_li]:mb-0.5"
                />
                {/* Word count */}
                <div className="flex items-center justify-end px-3 py-1 border-t border-white/[0.04]">
                  <span className={`text-[10px] ${wc.count > 5000 ? 'text-red-400' : wc.count > 1000 ? 'text-yellow-400' : 'text-white/35'}`}>
                    {wcText}
                  </span>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2">
                {(note.todos || []).map(t => (
                  <div key={t.id} className="group flex items-center gap-2 py-1.5 rounded hover:bg-white/[0.03] transition-colors">
                    <button onClick={() => toggleNoteTodo(t.id)}
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${t.done ? 'bg-fluent-blue/20 border-fluent-blue/30' : 'border-white/20 hover:border-white/40'}`}>
                      {t.done && <svg className="w-2 h-2 text-fluent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <span className={`flex-1 text-xs ${t.done ? 'text-white/65 line-through' : 'text-white/87'}`}>
                      {renderTodoText(t.text)}
                    </span>
                    <button onClick={() => deleteNoteTodo(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/55 hover:text-red-400/50 transition-all text-[9px]">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                  <input value={todoText} onChange={e => setTodoText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNoteTodo()}
                    placeholder="+ 新增"
                    disabled={isArchived || note.locked}
                    className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/55 outline-none disabled:opacity-40" />
                  {todoText.trim() && (
                    <button onClick={addNoteTodo} className="text-[10px] text-white/72 hover:text-white/72 transition-colors">添加</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resize handle - hidden when archived */}
        {!standalone && !note.locked && !note.collapsed && !isArchived && (
          <div onMouseDown={handleResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex-shrink-0 z-10 flex items-end justify-end">
            <svg className="w-3 h-3 text-white/[0.12] mb-0.5 mr-0.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M10 0v10H0" />
            </svg>
          </div>
        )}

        {/* Context menu */}
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={getContextMenuItems()}
            onClose={() => setCtxMenu(null)}
          />
        )}

        {/* Lock overlay — transparent, non-interactive barrier */}
        {note.locked && (
          <div className="absolute inset-0" style={{ background: 'transparent', pointerEvents: 'none' as React.CSSProperties['pointerEvents'] }} />
        )}
      </motion.div>
    </>
  )
}

export default FloatingNote
