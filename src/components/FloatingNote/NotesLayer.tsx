import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import FloatingNoteComp from './FloatingNote'
import CanvasMode from './CanvasMode'

const NotesLayer: React.FC = () => {
  const floatingNotes = useStore(s => s.floatingNotes)
  const noteSearchQuery = useStore(s => s.noteSearchQuery)
  const setNoteSearchQuery = useStore(s => s.setNoteSearchQuery)
  const canvasMode = useStore(s => s.canvasMode)
  const toggleCanvasMode = useStore(s => s.toggleCanvasMode)
  const [showArchived, setShowArchived] = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    floatingNotes.forEach(n => (n.tags || []).forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [floatingNotes])

  const filteredNotes = useMemo(() => {
    let list = showArchived
      ? floatingNotes.filter(n => n.archived)
      : floatingNotes.filter(n => !n.archived)

    // In Electron mode, hide floated notes (they have dedicated OS windows)
    const isElectron = !!(window as any).electronAPI
    if (isElectron) {
      list = list.filter(n => !n.floated)
    }

    const q = noteSearchQuery.trim().toLowerCase()
    if (q) {
      const keywords = q.split(/\s+/).filter(Boolean)
      list = list.filter(n => {
        const title = n.title.toLowerCase()
        const content = n.content?.toLowerCase() || ''
        const todoTexts = (n.todos || []).map(t => t.text.toLowerCase()).join(' ')
        const tagTexts = (n.tags || []).join(' ').toLowerCase()
        return keywords.every(k =>
          title.includes(k) || content.includes(k) || todoTexts.includes(k) || tagTexts.includes(k)
        )
      })
    }

    if (tagFilter) {
      list = list.filter(n => (n.tags || []).includes(tagFilter))
    }

    return list
  }, [floatingNotes, noteSearchQuery, showArchived, tagFilter])

  // Split: pinned notes go to a portal on body, non-pinned render in-place
  const nonPinned = useMemo(() => filteredNotes.filter(n => !n.pinned), [filteredNotes])
  const pinned = useMemo(() => filteredNotes.filter(n => n.pinned), [filteredNotes])

  const hasNotes = floatingNotes.length > 0
  const showEmpty = hasNotes && filteredNotes.length === 0 && (noteSearchQuery.trim().length > 0 || tagFilter !== null)

  const renderNote = (n: typeof filteredNotes[0]) => (
    <FloatingNoteComp key={n.id} note={n} matched={noteSearchQuery.trim().length > 0} />
  )

  return (
    <>
    <div className="absolute inset-0 z-10">
      {/* Canvas mode */}
      {canvasMode ? (
        <CanvasMode />
      ) : (
        <>
        {/* Search bar - only visible when there are notes */}
        {hasNotes && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5">
          <div className="w-[280px] max-w-[70vw] flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.04] focus-within:border-white/[0.1] transition-colors backdrop-blur-lg">
            <span className="text-white/60 text-xs"><i className="fa-solid fa-magnifying-glass" /></span>
            <input
              value={noteSearchQuery}
              onChange={e => setNoteSearchQuery(e.target.value)}
              placeholder="搜索便签..."
              className="flex-1 bg-transparent text-xs text-white/92 placeholder:text-white/60 outline-none"
            />
            {noteSearchQuery && (
              <button onClick={() => setNoteSearchQuery('')}
                className="text-[10px] text-white/60 hover:text-white/72 transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          {/* Controls row: archive toggle + tag filter + canvas toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCanvasMode}
              className={`px-2.5 py-1 rounded-lg text-[9px] transition-all border ${canvasMode ? 'bg-purple-400/10 border-purple-400/20 text-purple-400/70' : 'bg-white/[0.04] border-white/[0.04] text-white/50 hover:text-white/72'}`}
            >
              <i className="fa-regular fa-border-all mr-1" />
              {canvasMode ? '浮动模式' : '画布模式'}
            </button>

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-2.5 py-1 rounded-lg text-[9px] transition-all border ${showArchived ? 'bg-amber-400/10 border-amber-400/20 text-amber-400/70' : 'bg-white/[0.04] border-white/[0.04] text-white/50 hover:text-white/72'}`}
            >
              <i className="fa-regular fa-box-archive mr-1" />
              {showArchived ? '查看便签' : '查看归档'}
            </button>

            {allTags.length > 0 && !showArchived && (
              <select
                value={tagFilter || ''}
                onChange={e => setTagFilter(e.target.value || null)}
                className="bg-white/[0.04] border border-white/[0.04] rounded-lg text-[9px] px-2 py-1 text-white/60 outline-none cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <option value="">全部标签</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}

            {tagFilter && (
              <button onClick={() => setTagFilter(null)}
                className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 hover:text-white/60 transition-colors">
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center text-white/15">
            <i className="fa-regular fa-magnifying-glass text-lg mb-2" />
            <span className="text-xs">未找到匹配的便签</span>
          </div>
        </div>
      )}

      {/* Empty archived state */}
      {showArchived && !showEmpty && filteredNotes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center text-white/15">
            <i className="fa-regular fa-box-archive text-lg mb-2" />
            <span className="text-xs">暂无归档便签</span>
          </div>
        </div>
      )}

      {/* Non-pinned notes rendered in normal flow */}
      <AnimatePresence>
        {nonPinned.map(renderNote)}
      </AnimatePresence>
      </>
      )}
    </div>

    {/* Pinned notes portal — rendered at <body> end for highest stacking context */}
    {pinned.length > 0 && !canvasMode && createPortal(
      <AnimatePresence>
        {pinned.map(renderNote)}
      </AnimatePresence>,
      document.body
    )}
    </>
  )
}

export default NotesLayer
