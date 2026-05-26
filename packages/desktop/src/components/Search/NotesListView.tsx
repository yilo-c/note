import React, { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { getDescendantFolderIds } from '../../store/helpers'
import { useTranslation } from '../../i18n'
import { formatRelativeTime, stripHtml } from '../../utils/helpers'

type SortField = 'updatedAt' | 'createdAt' | 'title'
type SortDir = 'asc' | 'desc'

const NotesListView: React.FC = () => {
  const { t } = useTranslation()
  const floatingNotes = useStore(s => s.floatingNotes)
  const focusNote = useStore(s => s.focusNote)
  const updateFloatingNote = useStore(s => s.updateFloatingNote)
  const removeFloatingNote = useStore(s => s.removeFloatingNote)
  const activeFolderId = useStore(s => s.activeFolderId)
  const noteSearchQuery = useStore(s => s.noteSearchQuery)
  const setNotesViewMode = useStore(s => s.setNotesViewMode)
  const folders = useStore(s => s.folders)
  const locale = useStore(s => s.locale)

  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showArchived, setShowArchived] = useState(false)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Collect all tags
  const allTags = useMemo(() => {
    const set = new Set<string>()
    floatingNotes.forEach(n => (n.tags || []).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [floatingNotes])

  // Filter & sort
  const filtered = useMemo(() => {
    let list = showArchived
      ? floatingNotes.filter(n => n.archived)
      : floatingNotes.filter(n => !n.archived)

    // Folder filter — include notes from descendant folders too
    if (activeFolderId === '__uncategorized__') {
      list = list.filter(n => !n.folderId)
    } else if (activeFolderId) {
      const folderIds = getDescendantFolderIds(folders, activeFolderId)
      list = list.filter(n => n.folderId && folderIds.includes(n.folderId))
    }

    // Search
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

    // Tag filter
    if (tagFilter) {
      list = list.filter(n => (n.tags || []).includes(tagFilter))
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title)
      } else {
        const aVal = a[sortField] || 0
        const bVal = b[sortField] || 0
        cmp = aVal - bVal
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [floatingNotes, activeFolderId, noteSearchQuery, showArchived, tagFilter, sortField, sortDir, folders])

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return
    if (!confirm(t('common.confirm'))) return
    for (const id of selectedIds) {
      removeFloatingNote(id)
    }
    setSelectedIds(new Set())
  }

  const handleBatchArchive = () => {
    if (selectedIds.size === 0) return
    for (const id of selectedIds) {
      updateFloatingNote(id, { archived: true })
    }
    setSelectedIds(new Set())
  }

  const folderMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of folders) m.set(f.id, f.name)
    return m
  }, [folders])

  const sortArrow = (field: SortField): React.ReactNode => {
    if (sortField !== field) return null
    return sortDir === 'asc'
      ? <i className="fa-solid fa-arrow-up text-[7px] ml-0.5" />
      : <i className="fa-solid fa-arrow-down text-[7px] ml-0.5" />
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.04]">
        {/* Sort */}
        <div className="flex items-center gap-1 text-[9px] text-white/40">
          <button onClick={() => handleSortToggle('updatedAt')} className={`px-1.5 py-0.5 rounded hover:text-white/70 transition-colors ${sortField === 'updatedAt' ? 'text-white/70 bg-white/[0.04]' : ''}`}>
            {t('note.modifiedAt')}{sortArrow('updatedAt')}
          </button>
          <button onClick={() => handleSortToggle('createdAt')} className={`px-1.5 py-0.5 rounded hover:text-white/70 transition-colors ${sortField === 'createdAt' ? 'text-white/70 bg-white/[0.04]' : ''}`}>
            {t('note.createdAt')}{sortArrow('createdAt')}
          </button>
          <button onClick={() => handleSortToggle('title')} className={`px-1.5 py-0.5 rounded hover:text-white/70 transition-colors ${sortField === 'title' ? 'text-white/70 bg-white/[0.04]' : ''}`}>
            A-Z{sortArrow('title')}
          </button>
        </div>

        <div className="flex-1" />

        {/* Back to canvas */}
        <button
          onClick={() => setNotesViewMode('canvas')}
          className="px-2 py-0.5 rounded text-[9px] border border-white/[0.04] text-white/40 hover:text-white/60 transition-colors"
        >
          <i className="fa-solid fa-border-all mr-1" />
          {t('search.canvasMode')}
        </button>

        {/* Archive toggle */}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`px-2 py-0.5 rounded text-[9px] transition-all border ${showArchived ? 'bg-amber-400/10 border-amber-400/20 text-amber-400/70' : 'border-white/[0.04] text-white/40 hover:text-white/60'}`}
        >
          <i className="fa-solid fa-box-archive mr-1" />
          {showArchived ? t('search.viewNotes') : t('search.viewArchived')}
        </button>

        {/* Tag filter */}
        {allTags.length > 0 && !showArchived && (
          <select
            value={tagFilter || ''}
            onChange={e => setTagFilter(e.target.value || null)}
            className="bg-white/[0.04] border border-white/[0.04] rounded text-[9px] px-1.5 py-0.5 text-white/50 outline-none cursor-pointer"
          >
            <option value="">{t('search.allTags')}</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}

        {tagFilter && (
          <button onClick={() => setTagFilter(null)} className="text-[7px] text-white/40 hover:text-white/60">
            <i className="fa-solid fa-xmark" />
          </button>
        )}
      </div>

      {/* Batch action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.04]">
          <span className="text-[9px] text-white/50">{t('common.selectedCount', { count: selectedIds.size })}</span>
          <button onClick={handleBatchArchive} className="text-[9px] px-2 py-0.5 rounded text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors">
            <i className="fa-solid fa-box-archive mr-1" />{t('note.archive')}
          </button>
          <button onClick={handleBatchDelete} className="text-[9px] px-2 py-0.5 rounded text-white/50 hover:text-red-400/60 hover:bg-white/[0.04] transition-colors">
            <i className="fa-solid fa-trash-can mr-1" />{t('common.delete')}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[9px] px-2 py-0.5 rounded text-white/40 hover:text-white/60 transition-colors">
            {t('common.cancel')}
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/15">
            <i className="fa-solid fa-note-sticky text-lg mb-2" />
            <span className="text-xs">{t('search.noMatch')}</span>
          </div>
        ) : (
          filtered.map(note => (
            <div
              key={note.id}
              className={`group flex items-start gap-2 px-3 py-2 border-b border-white/[0.02] cursor-pointer transition-colors hover:bg-white/[0.03] ${
                selectedIds.has(note.id) ? 'bg-fluent-blue/[0.06]' : ''
              }`}
              onClick={() => focusNote(note.id)}
            >
              {/* Checkbox */}
              <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(note.id)}
                  onChange={() => toggleSelect(note.id)}
                  className="w-2.5 h-2.5 accent-fluent-blue cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {note.title || t('note.newNote')}
                  </span>
                  {note.archived && (
                    <span className="text-[7px] text-amber-400/60"><i className="fa-solid fa-box-archive" /></span>
                  )}
                  {note.pinned && (
                    <span className="text-[7px] text-fluent-blue/60"><i className="fa-solid fa-thumbtack" /></span>
                  )}
                  {note.locked && (
                    <span className="text-[7px] text-amber-400/40"><i className="fa-solid fa-lock" /></span>
                  )}
                </div>
                {/* Preview */}
                <div className="text-[9px] text-white/40 truncate mt-0.5">
                  {note.type === 'text'
                    ? stripHtml(note.content || '').slice(0, 120)
                    : (note.todos || []).map(t => t.text).join(', ').slice(0, 120)
                  }
                </div>
                {/* Meta */}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-white/25">
                    {formatRelativeTime(note.updatedAt || note.createdAt || Date.now(), locale)}
                  </span>
                  {note.folderId && folderMap.has(note.folderId) && (
                    <span className="text-[8px] px-1 py-0.5 rounded bg-white/[0.04] text-white/30">
                      {folderMap.get(note.folderId)}
                    </span>
                  )}
                  {(note.tags || []).length > 0 && (
                    <span className="text-[8px] text-white/25">
                      {(note.tags || []).slice(0, 3).join(', ')}
                      {(note.tags || []).length > 3 && '...'}
                    </span>
                  )}
                  {note.type === 'todo' && (
                    <span className="text-[8px] text-fluent-blue/40">
                      {(note.todos || []).filter(t => !t.done).length} pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default NotesListView
