import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Fuse from 'fuse.js'
import { useStore } from '../../store/useStore'
import { stripHtml, uid } from '../../utils/helpers'
import { extractContext } from '../../utils/searchContext'
import { getAIProvider } from '../../utils/ai'
import { useTranslation } from '../../i18n'

interface FlatItem {
  id: string
  noteId: string
  type: 'note' | 'todo'
  todoId?: string
  title: string
  preview: string
  tags: string[]
  done?: boolean
  createdAt: number
  matchContext?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const QuickSearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const floatingNotes = useStore(s => s.floatingNotes)
  const focusNote = useStore(s => s.focusNote)
  const addFloatingNote = useStore(s => s.addFloatingNote)
  const addTodo = useStore(s => s.addTodo)
  const nextZ = useStore(s => s.nextZ)
  const aiConfig = useStore(s => s.aiConfig)
  const setSearchHighlight = useStore(s => s.setSearchHighlight)
  const activeFolderId = useStore(s => s.activeFolderId)
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiCreated, setAiCreated] = useState(false)
  const [askResult, setAskResult] = useState('')
  const [askSources, setAskSources] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCreateMode = aiConfig.enabled && query.startsWith('>')
  const isAskMode = aiConfig.enabled && query.startsWith('?')

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchHighlight(null)
      setQuery('')
      setSelectedIdx(0)
      setAiLoading(false)
      setAiCreated(false)
      setAskResult('')
      setAskSources([])
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Clear close timer on unmount
  useEffect(() => {
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }
  }, [])

  // Build Fuse index — memoised on floatingNotes identity
  const fuse = useMemo(() => {
    const items: FlatItem[] = []
    for (const n of floatingNotes) {
      const plainContent = stripHtml(n.content || '')
      items.push({
        id: `note-${n.id}`,
        noteId: n.id,
        type: 'note',
        title: n.title,
        preview: plainContent.slice(0, 120),
        tags: n.tags || [],
        createdAt: n.createdAt || 0,
      })
      for (const td of n.todos || []) {
        if (!td?.text?.trim()) continue
        items.push({
          id: `todo-${td.id}`,
          noteId: n.id,
          todoId: td.id,
          type: 'todo',
          title: td.text,
          preview: t('search.belongsToNote', { title: n.title }),
          tags: [],
          done: td.done,
          createdAt: n.createdAt || 0,
        })
      }
    }
    return new Fuse(items, {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'preview', weight: 0.3 },
        { name: 'tags', weight: 0.2 },
      ],
      threshold: 0.4,
      distance: 100,
      minMatchCharLength: 1,
      includeScore: true,
    })
  }, [floatingNotes])

  // Compute results
  const results = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return null

    const raw = fuse.search(trimmed)
    const notes: FlatItem[] = []
    const todos: FlatItem[] = []
    for (const r of raw) {
      if (r.item.type === 'note') {
        // Clone to avoid mutating Fuse index
        const item = { ...r.item }
        const noteData = floatingNotes.find(n => n.id === item.noteId)
        if (noteData) {
          const plainContent = stripHtml(noteData.content || '')
          if (plainContent.toLowerCase().includes(trimmed.toLowerCase())) {
            item.matchContext = extractContext(plainContent, trimmed, 25)
          }
        }
        notes.push(item)
      } else {
        todos.push(r.item)
      }
    }
    return { notes: notes.slice(0, 10), todos: todos.slice(0, 10) }
  }, [query, fuse, floatingNotes])

  // Recent notes (when query is empty)
  const recentNotes = useMemo(() => {
    return [...floatingNotes]
      .filter(n => !n.archived)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5)
  }, [floatingNotes])

  // All result items flattened for keyboard nav
  const allItems = useMemo((): FlatItem[] => {
    if (!results) return []
    return [...results.notes, ...results.todos]
  }, [results])

  // Clamp selected index on results change
  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const activateItem = useCallback((item: FlatItem) => {
    const trimmed = query.trim()
    if (trimmed) {
      setSearchHighlight({ keyword: trimmed, noteId: item.noteId })
    }
    focusNote(item.noteId)
    onClose()
  }, [focusNote, onClose, setSearchHighlight, query])

  const handleAICreate = useCallback(async () => {
    const text = query.slice(1).trim()
    if (!text) return
    setAiLoading(true)
    try {
      const intent = await getAIProvider(aiConfig).parseIntent(text)
      if (intent.type === 'create_todo') {
        addTodo(intent.title || text, undefined)
        setAiCreated(true)
        setAiLoading(false)
        closeTimerRef.current = setTimeout(() => onClose(), 800)
        return
      }

      // Generate rich content if parsed intent has minimal content
      let content = intent.content || ''
      let title = intent.title || text.slice(0, 40)
      if (!content || content === intent.title || content.length < 20) {
        try {
          const prompt = `根据主题"${text}"生成一份结构清晰的笔记内容，使用 Markdown 格式，包含标题、要点列表和简短说明。内容要实用、有条理。`
          const genContent = await getAIProvider(aiConfig).processText('continue', prompt, () => {})
          if (genContent && genContent.length > content.length) {
            content = genContent
            // Extract title from first line if generated content has one
            const firstLine = genContent.split('\n')[0].replace(/^#\s*/, '').trim()
            if (firstLine && firstLine.length < 60) title = firstLine
          }
        } catch { /* fallback to parsed content */ }
      }

      addFloatingNote({
        id: uid(),
        type: 'text',
        title,
        content,
        tags: intent.tags || [],
        folderId: activeFolderId || undefined,
        x: 100 + Math.random() * 80,
        y: 100 + Math.random() * 80,
        width: 260,
        height: 200,
        zIndex: nextZ,
        floated: true,
        createdAt: Date.now(),
      })
      setAiCreated(true)
      setAiLoading(false)
      closeTimerRef.current = setTimeout(() => onClose(), 800)
    } catch {
      setAiLoading(false)
    }
  }, [query, addFloatingNote, addTodo, nextZ, onClose, activeFolderId])

  const handleAsk = useCallback(async () => {
    const question = query.slice(1).trim()
    if (!question) return
    setAiLoading(true)
    setAskResult('')
    setAskSources([])

    // Build context from fuse search results
    const raw = fuse.search(question)
    const contextNotes = raw.slice(0, 5).map(r => {
      const n = floatingNotes.find(fn => fn.id === r.item.noteId)
      return n ? { id: n.id, title: n.title, content: stripHtml(n.content || '').slice(0, 1500) } : null
    }).filter(Boolean) as { id: string; title: string; content: string }[]

    const contexts = contextNotes.map(n => `[${n.title}]\n${n.content}`)
    setAskSources(contextNotes.map(n => n.title))

    try {
      const answer = await getAIProvider(aiConfig).ask(question, contexts)
      setAskResult(answer)
    } catch {
      setAskResult(t('ai.askFailed'))
    } finally {
      setAiLoading(false)
    }
  }, [query, fuse, floatingNotes])

  // Arrow key + enter navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCreateMode || isAskMode) {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isCreateMode && !aiLoading && !aiCreated) handleAICreate()
        if (isAskMode && !aiLoading) handleAsk()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, Math.max(allItems.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allItems.length > 0 && selectedIdx < allItems.length) {
        activateItem(allItems[selectedIdx])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[selectedIdx] as HTMLElement
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!isOpen) return null

  const hasResults = results && (results.notes.length > 0 || results.todos.length > 0)
  const isEmpty = floatingNotes.length === 0

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-[15vh]"
      onMouseDown={onClose}
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="w-full max-w-[520px] border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
        onMouseDown={e => e.stopPropagation()}
        style={{
          background: 'var(--panel-bg-solid, rgba(22,22,32,0.95))',
          borderColor: 'var(--panel-border, rgba(255,255,255,0.08))',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.06))' }}>
          <i className="fa-solid fa-magnifying-glass text-xs" style={{ color: 'var(--text-muted, rgba(255,255,255,0.35))' }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-sm outline-none placeholder-white/30"
            style={{ color: 'var(--text-primary, rgba(255,255,255,0.92))' }}
          />
          <kbd className="text-[9px] px-1.5 py-0.5 rounded border" style={{
            color: 'var(--text-muted, rgba(255,255,255,0.3))',
            borderColor: 'var(--panel-border, rgba(255,255,255,0.08))',
            background: 'var(--hover-bg, rgba(255,255,255,0.04))',
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {/* AI Create Mode */}
          {isCreateMode && (
            <div className="flex flex-col items-center py-8 gap-3 px-4">
              <i className="fa-solid fa-wand-magic-sparkles text-lg" style={{ color: 'var(--fluent-blue, #60a5fa)' }} />
              {aiLoading ? (
                <>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('search.aiCreating')}</span>
                  <div className="w-5 h-5 border-2 border-fluent-blue/30 border-t-fluent-blue rounded-full animate-spin" />
                </>
              ) : aiCreated ? (
                <>
                  <i className="fa-solid fa-circle-check text-sm text-green-400" />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('search.aiCreated')}</span>
                </>
              ) : (
                <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  <kbd className="px-1 py-0.5 rounded border text-[9px]" style={{ borderColor: 'var(--panel-border)' }}>Enter</kbd> {t('search.aiCreateHint')}
                </span>
              )}
            </div>
          )}

          {/* AI Ask Mode */}
          {isAskMode && (
            <div className="flex flex-col gap-3 px-4 py-4">
              {!aiLoading && !askResult && !askSources.length && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <i className="fa-solid fa-circle-question text-lg" style={{ color: 'var(--fluent-blue, #60a5fa)' }} />
                  <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    <kbd className="px-1 py-0.5 rounded border text-[9px]" style={{ borderColor: 'var(--panel-border)' }}>Enter</kbd> {t('search.askHint')}
                  </span>
                </div>
              )}

              {aiLoading && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="w-5 h-5 border-2 border-fluent-blue/30 border-t-fluent-blue rounded-full animate-spin" />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('search.askLoading')}</span>
                </div>
              )}

              {askResult && (
                <div className="flex flex-col gap-3">
                  <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                    {askResult}
                  </div>
                  {askSources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>{t('search.sources')}</span>
                      {askSources.map((s, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const sourcesText = askSources.length > 0 ? '\n\n来源：' + askSources.join('、') : ''
                      addFloatingNote({
                        id: uid(),
                        type: 'text',
                        title: query.slice(1).trim().slice(0, 60),
                        content: askResult + sourcesText,
                        x: 100 + Math.random() * 80,
                        y: 100 + Math.random() * 80,
                        width: 260,
                        height: 200,
                        zIndex: nextZ,
                        floated: true,
                        createdAt: Date.now(),
                      })
                      onClose()
                    }}
                    className="self-start flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-lg transition-colors hover:bg-white/[0.06]"
                    style={{ color: 'var(--fluent-blue, #60a5fa)' }}
                  >
                    <i className="fa-regular fa-note-sticky text-[9px]" />
                    {t('common.save')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Normal search results (hidden in AI modes) */}
          {!isCreateMode && !isAskMode && (
            <>
          {isEmpty && (
            <div className="flex flex-col items-center py-8 gap-2">
              <i className="fa-regular fa-note-sticky text-lg" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('search.empty')}</span>
            </div>
          )}

          {!isEmpty && !results && (
            /* Recent notes */
            <div>
              <div className="px-4 py-1.5 text-[10px] font-medium tracking-wide" style={{ color: 'var(--text-muted, rgba(255,255,255,0.35))' }}>
                {t('search.recent')}
              </div>
              {recentNotes.map(n => (
                <button
                  key={n.id}
                  onClick={() => { focusNote(n.id); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <i className="fa-regular fa-note-sticky text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{n.title}</div>
                    <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {stripHtml(n.content || '').slice(0, 60) || (n.todos || []).map(t => t.text).join(', ').slice(0, 60)}
                    </div>
                  </div>
                  {n.tags && n.tags.length > 0 && (
                    <div className="flex gap-1 flex-shrink-0">
                      {n.tags.slice(0, 2).map(t => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!isEmpty && results && !hasResults && (
            <div className="flex flex-col items-center py-8 gap-2">
              <i className="fa-solid fa-magnifying-glass text-lg" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('search.noMatchFor', { query: query.trim() })}
              </span>
            </div>
          )}

          {results && hasResults && (
            <>
              {results.notes.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-medium tracking-wide" style={{ color: 'var(--text-muted, rgba(255,255,255,0.35))' }}>
                    {t('search.sectionNotes', { count: results.notes.length })}
                  </div>
                  {results.notes.map((item, i) => (
                    <button
                      key={item.id}
                      onClick={() => activateItem(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        i === selectedIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <i className="fa-regular fa-note-sticky text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{highlightMatch(item.title, query)}</div>
                        {item.matchContext && (
                          <div className="text-[10px] truncate mt-0.5 text-amber-400/60">
                            <i className="fa-solid fa-location-arrow mr-1 text-[8px]" />
                            {item.matchContext}
                          </div>
                        )}
                        {item.preview && (
                          <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.preview.slice(0, 80)}</div>
                        )}
                      </div>
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 flex-shrink-0">
                          {item.tags.slice(0, 2).map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {results.todos.length > 0 && (
                <div>
                  <div className="px-4 py-1.5 text-[10px] font-medium tracking-wide border-t" style={{ color: 'var(--text-muted, rgba(255,255,255,0.35))', borderColor: 'var(--panel-border, rgba(255,255,255,0.04))' }}>
                    {t('search.sectionTodos', { count: results.todos.length })}
                  </div>
                  {results.todos.map((item, i) => {
                    const listIdx = results.notes.length + i
                    return (
                      <button
                        key={item.id}
                        onClick={() => activateItem(item)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          listIdx === selectedIdx ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <i className={`text-[10px] flex-shrink-0 ${item.done ? 'fa-regular fa-circle-check' : 'fa-regular fa-circle'}`}
                          style={{ color: item.done ? 'var(--fluent-blue, #60a5fa)' : 'var(--text-muted)' }} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs truncate ${item.done ? 'line-through' : ''}`}
                            style={{ color: item.done ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                            {highlightMatch(item.title, query)}
                          </div>
                          <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-dim, rgba(255,255,255,0.25))' }}>
                            {item.preview}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-1.5 border-t flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--panel-border, rgba(255,255,255,0.04))' }}>
          {aiConfig.enabled && (
            <>
              <span className="text-[9px]" style={{ color: 'var(--text-dim, rgba(255,255,255,0.25))' }}>
                <kbd className="px-1 py-0.5 rounded border text-[8px]" style={{ borderColor: 'var(--panel-border)' }}>&gt;</kbd> {t('search.aiCreate')}
              </span>
              <span className="text-[9px]" style={{ color: 'var(--text-dim, rgba(255,255,255,0.25))' }}>
                <kbd className="px-1 py-0.5 rounded border text-[8px]" style={{ borderColor: 'var(--panel-border)' }}>?</kbd> {t('search.aiAsk')}
              </span>
            </>
          )}
          <span className="text-[9px]" style={{ color: 'var(--text-dim, rgba(255,255,255,0.25))' }}>
            <kbd className="px-1 py-0.5 rounded border text-[8px]" style={{ borderColor: 'var(--panel-border)' }}>↑↓</kbd> {t('search.nav')}
          </span>
          <span className="text-[9px]" style={{ color: 'var(--text-dim, rgba(255,255,255,0.25))' }}>
            <kbd className="px-1 py-0.5 rounded border text-[8px]" style={{ borderColor: 'var(--panel-border)' }}>Enter</kbd> {t('search.open')}
          </span>
          <span className="text-[9px]" style={{ color: 'var(--text-dim, rgba(255,255,255,0.25))' }}>
            <kbd className="px-1 py-0.5 rounded border text-[8px]" style={{ borderColor: 'var(--panel-border)' }}>Esc</kbd> {t('search.close')}
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** Wrap matching portions of text in a highlight span */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} style={{ color: 'var(--fluent-blue, #60a5fa)' }}>{part}</span>
      : part
  )
}

export default QuickSearchModal
