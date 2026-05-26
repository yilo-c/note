import React, { useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { getDescendantFolderIds } from '../../store/helpers'
import { useTranslation } from '../../i18n'
import { formatRelativeTime, stripHtml } from '../../utils/helpers'
import ContextMenu, { MenuItem } from './ContextMenu'
import SortMenu, { SortOption } from './SortMenu'

const ei = window.electronAPI as ElectronAPI | undefined
const isElectron = !!ei

// ── Memoised note list item, each subscribes to store independently ──
const NoteListItem: React.FC<{
  noteId: string
  onContextMenu?: (e: React.MouseEvent, noteId: string) => void
  batchMode?: boolean
  selected?: boolean
  onToggleSelect?: (noteId: string) => void
}> = React.memo(({ noteId, onContextMenu, batchMode, selected, onToggleSelect }) => {
  const { t } = useTranslation()
  const note = useStore(s => s.floatingNotes.find(n => n.id === noteId))
  const locale = useStore(s => s.locale)
  const folderName = useStore(s => {
    const n = s.floatingNotes.find(x => x.id === noteId)
    if (!n?.folderId) return null
    return s.folders.find(f => f.id === n.folderId)?.name || null
  })
  const setEditingNoteId = useStore(s => s.setEditingNoteId)

  // ── Drag ghost via direct DOM ──
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const wasDraggedRef = useRef(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (batchMode) return
    if ((e.target as HTMLElement).closest('button')) return
    wasDraggedRef.current = false
    const startX = e.clientX
    const startY = e.clientY

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        if (!ghostRef.current) {
          const el = document.createElement('div')
          el.className = 'fixed pointer-events-none z-[99999]'
          el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.1);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px 12px;box-shadow:0 8px 32px rgba(0,0,0,0.5)"><svg style="width:10px;height:10px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 8h8v8H8z"/></svg><span style="font-size:11px;color:rgba(255,255,255,0.8);white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">${note?.title || ''}</span></div>`
          el.style.left = (ev.clientX - 20) + 'px'
          el.style.top = (ev.clientY - 16) + 'px'
          document.body.appendChild(el)
          ghostRef.current = el
        } else {
          ghostRef.current.style.left = (ev.clientX - 20) + 'px'
          ghostRef.current.style.top = (ev.clientY - 16) + 'px'
        }
      }
    }

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      if (ghostRef.current) {
        ghostRef.current.remove()
        ghostRef.current = null
      }

      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        wasDraggedRef.current = true
        useStore.getState().moveNote(noteId, ev.clientX - 50, ev.clientY - 20)
        useStore.getState().updateFloatingNote(noteId, { zIndex: 999999, floated: true })
        if (isElectron) {
          ei?.createFloatingWindow({ id: noteId, screenX: ev.clientX - 50, screenY: ev.clientY - 20, width: 260, height: 200, backgroundMode: useStore.getState().backgroundMode })
        }
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleClick = () => {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false
      return
    }
    if (batchMode) {
      onToggleSelect?.(noteId)
      return
    }
    setEditingNoteId(noteId)
  }

  React.useEffect(() => {
    return () => { ghostRef.current?.remove() }
  }, [])

  if (!note) return null

  return (
    <motion.div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, noteId) : undefined}
      className="flex items-start gap-1 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-default select-none"
      style={batchMode && selected ? { background: 'rgba(0,122,255,0.08)' } : undefined}
    >
      {batchMode && (
        <span
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(noteId) }}
          className="flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors mt-0.5"
          style={{ borderColor: selected ? 'var(--fluent-blue)' : 'var(--text-dim)' }}
        >
          {selected && (
            <i className="fa-solid fa-check text-[7px]" style={{ color: 'var(--fluent-blue)' }} />
          )}
        </span>
      )}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
            {note.title || t('note.newNote')}
          </span>
          {note.pinned && <i className="fa-solid fa-thumbtack text-[6px] text-fluent-blue/50" />}
        </div>
        <div className="text-[8px] text-white/35 truncate mt-0.5">
          {note.type === 'text'
            ? note.summary || stripHtml(note.content || '').slice(0, 80)
            : (note.todos || []).map(t => t.text).join(', ').slice(0, 80)
          }
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[7px] text-white/25">
            {formatRelativeTime(note.updatedAt || note.createdAt || Date.now(), locale)}
          </span>
          {folderName && (
            <span className="text-[7px] px-1 py-0.5 rounded bg-white/[0.04] text-white/25">
              {folderName}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
})

// ── Note sort modes ──
type NoteSortMode = 'created' | 'updated' | 'alpha'

const NOTES_SORT_OPTIONS: SortOption[] = [
  { mode: 'created', tKey: 'todo.sortByCreated' },
  { mode: 'updated', tKey: 'todo.sortByUpdated' },
  { mode: 'alpha', tKey: 'todo.sortByAlpha' },
]

const NotesBrowser: React.FC = () => {
  const { t } = useTranslation()
  const floatingNotes = useStore(s => s.floatingNotes)
  const activeFolderId = useStore(s => s.activeFolderId)
  const folders = useStore(s => s.folders)
  const setViewMode = useStore(s => s.setViewMode)
  const updateFloatingNote = useStore(s => s.updateFloatingNote)
  const removeFloatingNote = useStore(s => s.removeFloatingNote)
  const moveNoteToFolder = useStore(s => s.moveNoteToFolder)
  const batchDeleteNotes = useStore(s => s.batchDeleteNotes)
  const batchArchiveNotes = useStore(s => s.batchArchiveNotes)
  const batchMoveNotesToFolder = useStore(s => s.batchMoveNotesToFolder)
  const [search, setSearch] = React.useState('')
  const [noteSortMode, setNoteSortMode] = React.useState<NoteSortMode>('created')
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number; noteId: string } | null>(null)
  const [folderPickerNoteId, setFolderPickerNoteId] = React.useState<string | null>(null)
  const [noteBatchMode, setNoteBatchMode] = React.useState(false)
  const [selectedNoteIds, setSelectedNoteIds] = React.useState<Set<string>>(new Set())
  const [noteFolderPickerIds, setNoteFolderPickerIds] = React.useState<Set<string> | null>(null)
  const [noteSortAsc, setNoteSortAsc] = React.useState(false)
  const [tagFilter, setTagFilter] = React.useState<string | null>(null)
  const [showArchived, setShowArchived] = React.useState(false)
  const [tagsCollapsed, setTagsCollapsed] = React.useState(true)

  const MAX_VISIBLE_TAGS = 6

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const n of floatingNotes) {
      if (n.tags) n.tags.forEach(t => tagSet.add(t))
    }
    return Array.from(tagSet).sort()
  }, [floatingNotes])

  const filtered = useMemo(() => {
    let list = floatingNotes.filter(n => (showArchived ? n.archived : !n.archived) && n.type !== 'todo')

    // Folder filter — include descendant folders
    if (activeFolderId === '__uncategorized__') {
      list = list.filter(n => !n.folderId)
    } else if (activeFolderId) {
      const folderIds = getDescendantFolderIds(folders, activeFolderId)
      list = list.filter(n => n.folderId && folderIds.includes(n.folderId))
    }

    // Tag filter
    if (tagFilter) {
      list = list.filter(n => n.tags?.includes(tagFilter))
    }

    // Search
    const q = search.trim().toLowerCase()
    if (q) {
      const keywords = q.split(/\s+/).filter(Boolean)
      list = list.filter(n => {
        const title = n.title.toLowerCase()
        const content = n.content?.toLowerCase() || ''
        const todoTexts = (n.todos || []).map(t => t.text.toLowerCase()).join(' ')
        return keywords.every(k =>
          title.includes(k) || content.includes(k) || todoTexts.includes(k)
        )
      })
    }

    const sorted = [...list]
    switch (noteSortMode) {
      case 'alpha':
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
        break
      case 'updated':
        sorted.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        break
      case 'created':
      default:
        sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        break
    }
    if (!noteSortAsc) sorted.reverse()
    return sorted
  }, [floatingNotes, activeFolderId, folders, search, noteSortMode, noteSortAsc, tagFilter, showArchived])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Search bar */}
      <div className="px-3 pt-2 pb-1 min-w-0">
        <div className="flex items-center gap-2 bg-white/[0.04] rounded-lg px-2 py-1.5 border border-white/[0.04] focus-within:border-white/[0.1]">
          <i className="fa-solid fa-magnifying-glass text-[9px] text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('panel.searchNotes')}
            className="flex-1 bg-transparent text-[10px] text-white/92 placeholder:text-white/40 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[8px] text-white/40 hover:text-white/60">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
          <button
            onClick={() => setViewMode('calendar')}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors text-white/50 hover:text-white/72 hover:bg-white/[0.04] flex-shrink-0"
            title={t('todo.viewMode.calendar')}
          >
            <i className="fa-solid fa-calendar-days text-[9px]" />
          </button>
          <SortMenu
            options={NOTES_SORT_OPTIONS}
            current={noteSortMode}
            asc={noteSortAsc}
            onSelect={(mode) => setNoteSortMode(mode as NoteSortMode)}
            onToggleDir={() => setNoteSortAsc(!noteSortAsc)}
            t={t}
            titleKey="todo.sortTitle"
          />
          <button
            onClick={() => { setShowArchived(!showArchived); setTagFilter(null) }}
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors flex-shrink-0 ${showArchived ? 'text-white/87 bg-white/[0.08]' : 'text-white/50 hover:text-white/72 hover:bg-white/[0.04]'}`}
            title={showArchived ? t('search.viewNotes') : t('search.viewArchived')}
          >
            <i className="fa-solid fa-box-archive text-[9px]" />
          </button>
          <button
            onClick={() => { if (noteBatchMode) setSelectedNoteIds(new Set()); setNoteBatchMode(!noteBatchMode) }}
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors flex-shrink-0 ${noteBatchMode ? 'text-white/87 bg-white/[0.08]' : 'text-white/50 hover:text-white/72 hover:bg-white/[0.04]'}`}
            title={t('todo.batchSelect')}
          >
            <i className="fa-solid fa-check-square text-[9px]" />
          </button>
        </div>
      </div>

      {noteBatchMode && (
        <div className="flex items-center gap-2 px-3 pb-1.5">
          <i className="fa-solid fa-check-square text-[8px] text-fluent-blue/50" />
          <span className="text-[9px] text-white/40">{t('todo.batchModeHint')}</span>
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && !noteBatchMode && !showArchived && (
        <div className="flex items-center gap-1 px-3 pb-1.5 flex-wrap">
          <button
            onClick={() => setTagFilter(null)}
            className={`text-[9px] px-2 py-0.5 rounded-full transition-all ${!tagFilter ? 'text-white/87 bg-white/[0.08]' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'}`}
          >
            {t('category.all')}
          </button>
          {(tagsCollapsed ? allTags.slice(0, MAX_VISIBLE_TAGS) : allTags).map(tag => (
            <button
              key={tag}
              onClick={() => setTagFilter(tag === tagFilter ? null : tag)}
              className={`text-[9px] px-2 py-0.5 rounded-full transition-all ${tag === tagFilter ? 'text-white/87 bg-white/[0.08]' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'}`}
            >
              # {tag}
            </button>
          ))}
          {allTags.length > MAX_VISIBLE_TAGS && (
            <button
              onClick={() => setTagsCollapsed(!tagsCollapsed)}
              className="text-[9px] px-2 py-0.5 rounded-full transition-all text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
            >
              {tagsCollapsed ? t('note.showMoreCount', { count: allTags.length - MAX_VISIBLE_TAGS }) : t('note.collapse')}
            </button>
          )}
        </div>
      )}

      {/* Note list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20">
            <i className="fa-solid fa-note-sticky text-base mb-2" />
            <span className="text-[10px]">{t('search.noMatch')}</span>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map(note => (
              <NoteListItem key={note.id} noteId={note.id}
                batchMode={noteBatchMode}
                selected={selectedNoteIds.has(note.id)}
                onToggleSelect={(id) => setSelectedNoteIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
                onContextMenu={(e, noteId) => {
                  e.preventDefault()
                  setCtxMenu({ x: e.clientX, y: e.clientY, noteId })
                }} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Batch action bar */}
      {noteBatchMode && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.04] bg-white/[0.02]">
          <span className="text-[10px] text-white/50 min-w-[60px]">
            {t('common.selectedCount', { count: selectedNoteIds.size })}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => {
              const ids = Array.from(selectedNoteIds)
              batchArchiveNotes(ids, !showArchived)
              setSelectedNoteIds(new Set())
            }}
            disabled={selectedNoteIds.size === 0}
            className="text-[9px] px-2 py-1 rounded-lg transition-colors disabled:opacity-30 text-white/50 hover:text-white/72 hover:bg-white/[0.04]"
          >
            <i className="fa-solid fa-box-archive mr-1" />{showArchived ? t('note.unarchive') : t('note.archive')}
          </button>
          <button
            onClick={() => {
              setNoteFolderPickerIds(selectedNoteIds)
            }}
            disabled={selectedNoteIds.size === 0}
            className="text-[9px] px-2 py-1 rounded-lg transition-colors disabled:opacity-30 text-white/50 hover:text-white/72 hover:bg-white/[0.04]"
          >
            <i className="fa-solid fa-folder-open mr-1" />{t('folder.moveToFolder')}
          </button>
          <button
            onClick={() => {
              if (!confirm(t('note.batchDeleteConfirm', { count: selectedNoteIds.size }))) return
              batchDeleteNotes(Array.from(selectedNoteIds))
              setSelectedNoteIds(new Set())
            }}
            disabled={selectedNoteIds.size === 0}
            className="text-[9px] px-2 py-1 rounded-lg transition-colors disabled:opacity-30 text-red-400/60 hover:text-red-400 hover:bg-white/[0.04]"
          >
            <i className="fa-solid fa-trash-can mr-1" />{t('common.delete')}
          </button>
        </div>
      )}

      {/* Right-click context menu */}
      {ctxMenu && (() => {
        const note = floatingNotes.find(n => n.id === ctxMenu.noteId)
        if (!note) return null
        const items: MenuItem[] = [
          {
            label: note.archived ? t('note.unarchive') : t('note.archive'),
            icon: 'fa-box-archive',
            onClick: () => updateFloatingNote(ctxMenu.noteId, { archived: !note.archived }),
          },
          {
            label: t('folder.moveToFolder'),
            icon: 'fa-folder-open',
            onClick: () => {
              setCtxMenu(null)
              setFolderPickerNoteId(ctxMenu.noteId)
            },
          },
          { label: '', icon: undefined, onClick: () => {} }, // separator
          {
            label: t('note.deleteTitle'),
            icon: 'fa-trash-can',
            danger: true,
            onClick: () => removeFloatingNote(ctxMenu.noteId),
          },
        ]
        return (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={items}
            onClose={() => setCtxMenu(null)}
          />
        )
      })()}

      {/* Folder picker overlay */}
      {folderPickerNoteId && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center"
          onClick={() => setFolderPickerNoteId(null)}
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
                moveNoteToFolder(folderPickerNoteId, 'default')
                setFolderPickerNoteId(null)
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
                  moveNoteToFolder(folderPickerNoteId, f.id)
                  setFolderPickerNoteId(null)
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
                moveNoteToFolder(folderPickerNoteId, null)
                setFolderPickerNoteId(null)
              }}
            >
              <i className="fa-regular fa-folder-minus text-[10px]" />
              {t('folder.noFolder')}
            </button>
          </div>
        </div>
      )}

      {/* Batch folder picker overlay */}
      {noteFolderPickerIds && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center"
          onClick={() => setNoteFolderPickerIds(null)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative w-56 max-h-64 overflow-y-auto rounded-xl border shadow-2xl p-1.5"
            style={{ background: 'var(--panel-bg-solid)', borderColor: 'var(--panel-border-accent)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-medium px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>
              {t('folder.moveToFolder')} ({t('common.selectedCount', { count: noteFolderPickerIds.size })})
            </div>
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/[0.06] text-left"
              style={{ color: 'var(--text-primary)' }}
              onClick={() => {
                batchMoveNotesToFolder(Array.from(noteFolderPickerIds), 'default')
                setNoteFolderPickerIds(null)
                setSelectedNoteIds(new Set())
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
                  batchMoveNotesToFolder(Array.from(noteFolderPickerIds), f.id)
                  setNoteFolderPickerIds(null)
                  setSelectedNoteIds(new Set())
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
                batchMoveNotesToFolder(Array.from(noteFolderPickerIds), null)
                setNoteFolderPickerIds(null)
                setSelectedNoteIds(new Set())
              }}
            >
              <i className="fa-regular fa-folder-minus text-[10px]" />
              {t('folder.noFolder')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotesBrowser
