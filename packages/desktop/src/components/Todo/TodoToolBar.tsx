import React from 'react'
import { ViewMode } from '../../types'
import { SortMode } from './todoListUtils'
import SortMenu, { SortOption } from '../Common/SortMenu'

const TODO_SORT_OPTIONS: SortOption[] = [
  { mode: 'created', tKey: 'todo.sortByCreated' },
  { mode: 'priority', tKey: 'todo.sortByPriority' },
  { mode: 'dueDate', tKey: 'todo.sortByDueDate' },
  { mode: 'alpha', tKey: 'todo.sortByAlpha' },
]

interface TodoToolBarProps {
  searchQuery: string
  setSearchQuery: (q: string) => void
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  sortMode: SortMode
  setSortMode: (m: SortMode) => void
  filterStatus: 'all' | 'active' | 'completed' | 'overdue'
  setFilterStatus: (s: 'all' | 'active' | 'completed' | 'overdue') => void
  filterPriority: number[]
  toggleFilterPriority: (p: number) => void
  t: (key: string, params?: Record<string, string | number>) => string
  batchMode?: boolean
  onToggleBatch?: () => void
  sortAsc?: boolean
  onToggleSortDir?: () => void
}

const TodoToolBar: React.FC<TodoToolBarProps> = ({
  searchQuery, setSearchQuery, viewMode, setViewMode, sortMode, setSortMode,
  filterStatus, setFilterStatus, filterPriority, toggleFilterPriority,
  t, batchMode, onToggleBatch, sortAsc, onToggleSortDir,
}) => {
  return (
    <>
      <div className="px-3 pt-2 pb-1 min-w-0">
        <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-1.5 border border-white/[0.04] focus-within:border-white/[0.1] transition-colors min-w-0">
          <span className="text-white/60 text-xs flex-shrink-0"><i className="fa-solid fa-magnifying-glass" /></span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('todo.searchPlaceholder')}
            className="flex-1 bg-transparent text-xs text-white/92 placeholder:text-white/60 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="text-[10px] text-white/60 hover:text-white/72 transition-colors flex-shrink-0">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
          <button
            onClick={() => {
              const modes: ViewMode[] = ['list', 'calendar']
              const idx = modes.indexOf(viewMode)
              setViewMode(modes[(idx + 1) % 2])
            }}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors text-white/50 hover:text-white/72 hover:bg-white/[0.04] flex-shrink-0"
            title={
              viewMode === 'list' ? t('todo.viewMode.calendar') : t('todo.viewMode.list')
            }
          >
            <i className={`fa-solid ${
              viewMode === 'list' ? 'fa-calendar-days' : 'fa-list'
            } text-[10px]`} />
            <span className="hidden md:inline">
              {viewMode === 'list' ? t('todo.viewMode.calendarShort') : t('todo.viewMode.listShort')}
            </span>
          </button>
          <SortMenu
            options={TODO_SORT_OPTIONS}
            current={sortMode}
            asc={sortAsc ?? true}
            onSelect={(mode) => setSortMode(mode as SortMode)}
            onToggleDir={onToggleSortDir ?? (() => {})}
            t={t}
            titleKey="todo.sortTitle"
          />
          <button
            onClick={onToggleBatch}
            className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors flex-shrink-0 ${batchMode ? 'text-white/87 bg-white/[0.08]' : 'text-white/50 hover:text-white/72 hover:bg-white/[0.04]'}`}
            title={t('todo.batchSelect')}
          >
            <i className="fa-solid fa-check-square text-[10px]" />
          </button>
        </div>
      </div>

      {!batchMode && (
      <div className="flex items-center gap-1 px-3 pb-1">
        {(['all', 'active', 'completed', 'overdue'] as const).map(s => {
          const active = filterStatus === s
          const label = s === 'all' ? t('todo.all') : s === 'active' ? t('todo.active') : s === 'completed' ? t('todo.completed') : t('todo.overdue')
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-[9px] px-2 py-0.5 rounded-full transition-all ${active ? 'text-white/87 bg-white/[0.08]' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'}`}>
              {label}
            </button>
          )
        })}
        <span className="text-white/[0.06] mx-0.5">|</span>
        {([0, 1, 2] as const).map(p => {
          const active = filterPriority.includes(p)
          const label = p === 0 ? 'P0' : p === 1 ? 'P1' : 'P2'
          const color = p === 0 ? '#f87171' : p === 1 ? '#fbbf24' : '#64748b'
          return (
            <button key={p} onClick={() => toggleFilterPriority(p)}
              className={`text-[9px] px-1.5 py-0.5 rounded-full transition-all ${active ? 'text-white/87' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'}`}
              style={active ? { background: `${color}20`, color } : undefined}>
              {label}
            </button>
          )
        })}
      </div>
      )}
      {batchMode && (
        <div className="flex items-center gap-2 px-3 pb-1.5">
          <i className="fa-solid fa-check-square text-[8px] text-fluent-blue/50" />
          <span className="text-[9px] text-white/40">{t('todo.batchModeHint')}</span>
        </div>
      )}
    </>
  )
}

export default TodoToolBar
