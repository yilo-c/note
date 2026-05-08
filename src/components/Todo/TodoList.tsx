import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { uid } from '../../utils/helpers'
import { TodoItem } from '../../types'
import ContextMenu, { MenuItem } from '../Common/ContextMenu'
import KanbanBoard from './KanbanBoard'
import PomodoroTimer from './PomodoroTimer'

const ei = (window as any).electronAPI
const isElectron = !!ei

const PRIORITY_COLORS: Record<number, string> = { 0: '#f87171', 1: '#fbbf24', 2: '#64748b' }
const PRIORITY_LABELS: Record<number, string> = { 0: 'P0', 1: 'P1', 2: 'P2' }

function cyclePriority(current: 0 | 1 | 2 | undefined): 0 | 1 | 2 | undefined {
  if (current === undefined) return 0
  if (current === 0) return 1
  if (current === 1) return 2
  return undefined
}

function formatDueDate(ts: number): string {
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function tsToDateInputValue(ts: number): string {
  const d = new Date(ts)
  return d.toISOString().slice(0, 10)
}

function isOverdue(dueDate: number): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return dueDate < now.getTime()
}

function isDueSoon(dueDate: number): boolean {
  const now = Date.now()
  return dueDate > now && dueDate - now < 24 * 60 * 60 * 1000
}

type SortMode = 'created' | 'priority' | 'dueDate' | 'alpha'

const SORT_MODE_LABELS: Record<SortMode, string> = {
  created: '创建时间',
  priority: '优先级',
  dueDate: '截止日期',
  alpha: '字母顺序',
}

function getSortFn(mode: SortMode): (a: TodoItem, b: TodoItem) => number {
  switch (mode) {
    case 'priority':
      return (a, b) => {
        const pa = a.priority ?? 99
        const pb = b.priority ?? 99
        if (pa !== pb) return pa - pb
        return (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt)
      }
    case 'dueDate':
      return (a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt)
      }
    case 'alpha':
      return (a, b) => a.text.localeCompare(b.text)
    case 'created':
    default:
      return (a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt)
  }
}

function cycleSortMode(mode: SortMode): SortMode {
  const modes: SortMode[] = ['created', 'priority', 'dueDate', 'alpha']
  const idx = modes.indexOf(mode)
  return modes[(idx + 1) % modes.length]
}

const TodoList: React.FC = () => {
  const {
    toggleTodo, deleteTodo, addTodo, addFloatingNote, nextZ,
    searchQuery, setSearchQuery, clearDoneTodos, addingTodo, setAddingTodo,
    setPriority, setDueDate, moveTodo, moveTodoToPosition, sortMode, setSortMode,
    viewMode, setViewMode, floatingNotes, focusNote,
  } = useStore()
  const [dragTodo, setDragTodo] = useState<{ text: string; x: number; y: number } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; todoId: string } | null>(null)
  const [dragFromId, setDragFromId] = useState<string | null>(null)
  const [dragInsertIdx, setDragInsertIdx] = useState<number | null>(null)
  const [datePickerId, setDatePickerId] = useState<string | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const prevViewMode = useRef(viewMode)
  const todos = useStore(s => s.todos)
  const activeCat = useStore(s => s.activeCat)

  const filtered = useMemo(() => {
    let list = activeCat === 'all' ? todos : todos.filter(t => t.category === activeCat)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(t => t.text.toLowerCase().includes(q))
    }
    return list
  }, [todos, activeCat, searchQuery])

  const activeTodos = useMemo(
    () => filtered.filter(t => !t.done).sort(getSortFn(sortMode)),
    [filtered, sortMode]
  )
  const doneTodos = useMemo(
    () => filtered.filter(t => t.done).sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt)),
    [filtered]
  )

  // Search floating notes too
  const matchedNotes = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return floatingNotes.filter(n => {
      const title = n.title.toLowerCase()
      const content = (n.content || '').toLowerCase()
      return title.includes(q) || content.includes(q)
    })
  }, [floatingNotes, searchQuery])

  // Open date picker when it becomes active
  useEffect(() => {
    if (datePickerId && dateInputRef.current) {
      dateInputRef.current.showPicker?.()
    }
  }, [datePickerId])

  // Resize window when entering/leaving kanban mode (Electron only)
  useEffect(() => {
    if (!isElectron) return
    if (viewMode === 'board' && prevViewMode.current === 'list') {
      ei.resizeWindow(800, 600)
    } else if (viewMode === 'list' && prevViewMode.current === 'board') {
      ei.resizeWindow(380, 680)
    }
    prevViewMode.current = viewMode
  }, [viewMode])

  // Stats
  const totalCount = filtered.length
  const activeCount = activeTodos.length
  const doneCount = doneTodos.length
  const overdueCount = useMemo(
    () => todos.filter(t => !t.done && t.dueDate && isOverdue(t.dueDate)).length,
    [todos]
  )

  // --- Improved HTML5 Drag & Drop with insertion point ---
  const handleDragStart = useCallback((e: React.DragEvent, t: TodoItem) => {
    e.dataTransfer.setData('text/plain', t.id)
    e.dataTransfer.effectAllowed = 'move'
    setDragFromId(t.id)
  }, [])

  const handleListDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!dragFromId) return
    const items = document.querySelectorAll('[data-drag-item]')
    let idx = activeTodos.length
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        idx = i
        break
      }
    }
    setDragInsertIdx(idx)
  }, [dragFromId, activeTodos.length])

  const handleListDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (id && dragInsertIdx !== null && dragFromId) {
      moveTodoToPosition(id, dragInsertIdx)
    }
    setDragFromId(null)
    setDragInsertIdx(null)
  }, [dragInsertIdx, dragFromId, moveTodoToPosition])

  const handleDragEnd = useCallback(() => {
    setDragFromId(null)
    setDragInsertIdx(null)
  }, [])

  // --- Priority cycle ---
  const handlePriorityClick = useCallback((e: React.MouseEvent, id: string, current: 0 | 1 | 2 | undefined) => {
    e.stopPropagation()
    setPriority(id, cyclePriority(current))
  }, [setPriority])

  // --- Due date picker ---
  const handleDueDateClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDatePickerId(id)
  }, [])

  const handleDateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const val = e.target.value
    if (val) {
      setDueDate(id, new Date(val + 'T00:00:00').getTime())
    } else {
      setDueDate(id, undefined)
    }
    setDatePickerId(null)
  }, [setDueDate])

  // --- Existing drag-to-create-note ---
  const handleTodoMouseDown = (e: React.MouseEvent, t: typeof filtered[0]) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('[data-drag-handle]')) return
    const startX = e.clientX
    const startY = e.clientY
    let moved = false

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) > 8 && !moved) {
        moved = true
        setDragTodo({ text: t.text, x: ev.clientX, y: ev.clientY })
      }
      if (moved) {
        setDragTodo(g => g ? { ...g, x: ev.clientX, y: ev.clientY } : null)
      }
    }

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragTodo(null)

      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.sqrt(dx * dx + dy * dy) > 15) {
        const id = uid()
        addFloatingNote({
          id, type: 'todo', title: '待办',
          content: '', todos: [{ id: uid(), text: t.text, done: t.done, createdAt: t.createdAt }],
          x: ev.clientX - 130, y: ev.clientY - 30,
          width: 260, height: 160, zIndex: nextZ, floated: true,
        })
        if (isElectron) {
          ei.createFloatingWindow({ id, screenX: ev.clientX - 130, screenY: ev.clientY - 30, width: 260, height: 160 })
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleTodoContextMenu = (e: React.MouseEvent, todoId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, todoId })
  }

  const getCtxMenuItems = (): MenuItem[] => {
    const id = ctxMenu?.todoId
    if (!id) return []
    return [
      {
        label: '复制文本',
        icon: 'fa-copy',
        onClick: () => {
          const t = filtered.find(t => t.id === id)
          if (t) navigator.clipboard.writeText(t.text)
        },
      },
      {
        label: '删除',
        icon: 'fa-trash-can',
        danger: true,
        onClick: () => deleteTodo(id),
      },
    ]
  }

  // --- Render a single todo item ---
  const renderTodoItem = (t: typeof activeTodos[0], idx: number, isDone: boolean) => {
    const dueOverdue = t.dueDate && !t.done && isOverdue(t.dueDate)
    const dueSoon = t.dueDate && !t.done && isDueSoon(t.dueDate)
    const pc = t.priority !== undefined ? PRIORITY_COLORS[t.priority] : undefined

    return (
      <motion.div
        key={t.id}
        layout
        initial={{ opacity: 0, x: isDone ? 0 : -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 8 }}
        transition={{ duration: 0.2 }}
        data-drag-item={isDone ? undefined : true}
        className={`group px-2 py-2 rounded-lg hover:bg-white/[0.03] transition-colors cursor-default ${isDone ? 'opacity-60' : ''} ${dragFromId && dragInsertIdx !== null && dragInsertIdx === idx && !isDone ? 'border-t border-fluent-blue/40' : ''}`}
        onMouseDown={e => handleTodoMouseDown(e, t)}
        onContextMenu={e => handleTodoContextMenu(e, t.id)}
      >
        <div className="flex items-center gap-1.5">
          {/* Drag handle (active items only) — full drag zone */}
        {!isDone && (
          <span
            data-drag-handle
            draggable
            onDragStart={e => handleDragStart(e, t)}
            onDragEnd={handleDragEnd}
            className="flex-shrink-0 w-5 flex items-center justify-center self-stretch text-white/15 group-hover:text-white/40 hover:text-white/60 transition-colors text-[11px] cursor-grab active:cursor-grabbing select-none"
          >
            <i className="fa-solid fa-grip-lines" />
          </span>
        )}

        {/* Priority dot */}
        <span
          onClick={e => handlePriorityClick(e, t.id, t.priority)}
          className="flex-shrink-0 w-2.5 h-2.5 rounded-full cursor-pointer transition-all hover:scale-125"
          style={{
            background: pc ?? 'transparent',
            border: pc ? 'none' : '1px solid rgba(255,255,255,0.15)',
          }}
          title={t.priority !== undefined ? PRIORITY_LABELS[t.priority] : '点击设置优先级'}
        />

        {/* Checkbox */}
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => toggleTodo(t.id)}
          className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            borderColor: pc ? `${pc}88` : 'rgba(255,255,255,0.2)',
          }}
        >
          {isDone && (
            <svg className="w-2.5 h-2.5 text-white/72" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </motion.button>

        {/* Text */}
        <span className={`flex-1 text-xs leading-relaxed min-w-0 truncate ${isDone ? 'text-white/72 line-through' : 'text-white/87'}`}>
          {t.text}
        </span>

        {/* Due date badge */}
        {t.dueDate && (
          <span
            onClick={e => handleDueDateClick(e, t.id)}
            className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:bg-white/[0.06] ${dueOverdue ? 'text-red-400' : dueSoon ? 'text-yellow-400' : 'text-white/50'}`}
          >
            {formatDueDate(t.dueDate)}
          </span>
        )}

        {/* No due date badge - show clickable placeholder for active items */}
        {!t.dueDate && !isDone && (
          <span
            onClick={e => handleDueDateClick(e, t.id)}
            className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded text-white/15 hover:text-white/40 hover:bg-white/[0.06] cursor-pointer transition-colors"
          >
            <i className="fa-regular fa-calendar" />
          </span>
        )}

        {/* Time */}
        <span className="text-[10px] text-white/45 flex-shrink-0 hidden sm:inline">
          {new Date(t.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>

        {/* Pomodoro timer */}
        <PomodoroTimer todoId={t.id} />

        {/* Delete */}
        <button
          onClick={() => deleteTodo(t.id)}
          className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-red-400/60 transition-all text-[10px] px-1 flex-shrink-0"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

        {/* Hidden date input for picker */}
        {datePickerId === t.id && (
          <input
            ref={dateInputRef}
            type="date"
            className="absolute opacity-0 pointer-events-none w-0 h-0"
            value={t.dueDate ? tsToDateInputValue(t.dueDate) : ''}
            onChange={e => handleDateChange(e, t.id)}
            onBlur={() => setDatePickerId(null)}
          />
        )}
      </motion.div>
    )
  }

  return (
    <>
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 bg-white/[0.04] rounded-xl px-3 py-2 border border-white/[0.04] focus-within:border-white/[0.1] transition-colors">
          <span className="text-white/60 text-xs"><i className="fa-solid fa-magnifying-glass" /></span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索"
            className="flex-1 bg-transparent text-xs text-white/92 placeholder:text-white/60 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="text-[10px] text-white/60 hover:text-white/72 transition-colors">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
          {/* View mode toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'board' : 'list')}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors text-white/50 hover:text-white/72 hover:bg-white/[0.04]"
            title={viewMode === 'list' ? '看板视图' : '列表视图'}
          >
            <i className={`fa-solid ${viewMode === 'list' ? 'fa-table-columns' : 'fa-list'} text-[10px]`} />
            <span className="hidden sm:inline">{viewMode === 'list' ? '看板' : '列表'}</span>
          </button>
          {/* Sort toggle */}
          <button
            onClick={() => setSortMode(cycleSortMode(sortMode))}
            className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-lg transition-colors text-white/50 hover:text-white/72 hover:bg-white/[0.04]"
            title={`排序: ${SORT_MODE_LABELS[sortMode]}`}
          >
            <i className="fa-solid fa-arrow-up-wide-short text-[10px]" />
            <span className="hidden sm:inline">{SORT_MODE_LABELS[sortMode]}</span>
          </button>
        </div>
      </div>

      {/* Matched floating notes */}
      {searchQuery.trim() && matchedNotes.length > 0 && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-1.5 mb-1">
            <i className="fa-regular fa-note-sticky text-[9px] text-white/40" />
            <span className="text-[9px] text-white/40">相关便签 ({matchedNotes.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {matchedNotes.map(n => (
              <button
                key={n.id}
                onClick={() => focusNote(n.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/70 hover:text-white bg-white/[0.04] hover:bg-white/[0.06] transition-all truncate max-w-[180px]"
                title={n.title}
              >
                <i className="fa-regular fa-note-sticky text-[8px] text-white/40 flex-shrink-0" />
                <span className="truncate">{n.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline add input */}
      {addingTodo && viewMode === 'list' && <InlineAddInput />}

      {/* Content: Kanban board or List */}
      {viewMode === 'board' ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <KanbanBoard />
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-1.5"
        onDragOver={handleListDragOver}
        onDrop={handleListDrop}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/15">
            {searchQuery.trim() ? (
              <>
                <i className="fa-regular fa-magnifying-glass text-lg mb-2" />
                <span className="text-xs">未找到匹配的待办</span>
              </>
            ) : (
              <>
                <i className="fa-regular fa-pen-to-square text-lg mb-3" />
                <span className="text-xs">暂无待办</span>
              </>
            )}
          </div>
        ) : (
        <>
        {/* Active items */}
        <AnimatePresence mode="popLayout">
          {activeTodos.map((t, idx) => {
            // Insertion line before this item
            const showLine = dragFromId && dragInsertIdx === idx && dragFromId !== t.id
            return (
              <React.Fragment key={t.id}>
                {showLine && <div className="h-0.5 rounded-full bg-fluent-blue/50 mx-2 mb-0.5" />}
                {renderTodoItem(t, idx, false)}
              </React.Fragment>
            )
          })}
        </AnimatePresence>
        {/* Insertion line at end of list */}
        {dragFromId && dragInsertIdx === activeTodos.length && activeTodos.length > 0 && (
          <div className="h-0.5 rounded-full bg-fluent-blue/50 mx-2 mt-0.5" />
        )}

        {/* Separator + done items */}
        {doneTodos.length > 0 && (
          <>
            <div className="flex items-center gap-2 mx-3 my-1.5">
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="text-[9px] text-white/15">{doneTodos.length} 项已完成</span>
              <button onClick={clearDoneTodos}
                className="text-[9px] text-white/15 hover:text-red-400/50 transition-colors">
                清除
              </button>
              <div className="flex-1 h-px bg-white/[0.04]" />
            </div>
            <AnimatePresence>
              {doneTodos.map((t, idx) => renderTodoItem(t, idx, true))}
            </AnimatePresence>
          </>
        )}
        </>
      )}
      </div>
      )}
    </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center gap-1.5 text-[10px] text-white/50">
          <span>全部 {totalCount}</span>
          <span className="text-white/20">·</span>
          <span>未完成 {activeCount}</span>
          <span className="text-white/20">·</span>
          <span>已完成 {doneCount}</span>
          <span className="text-white/20">·</span>
          <span className={overdueCount > 0 ? 'text-red-400' : ''}>逾期 {overdueCount}</span>
        </div>
        <div className="flex items-center gap-1">
          {doneCount > 0 && (
            <button
              onClick={clearDoneTodos}
              className="text-[9px] text-white/15 hover:text-red-400/60 transition-colors"
            >
              清除已完成
            </button>
          )}
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={getCtxMenuItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* Drag ghost */}
      {dragTodo && (
        <div
          className="fixed pointer-events-none z-[9999] text-xs px-2.5 py-1.5 rounded-lg shadow-2xl bg-[rgba(18,18,28,0.96)] border border-white/[0.08] text-white/92"
          style={{ left: dragTodo.x - 20, top: dragTodo.y - 16, maxWidth: 220 }}
        >
          {dragTodo.text}
        </div>
      )}
    </>
  )
}

const InlineAddInput: React.FC = () => {
  const { addTodo, activeCat, setAddingTodo } = useStore()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const v = value.trim()
    if (v) addTodo(v, activeCat === 'all' ? undefined : activeCat)
    setAddingTodo(false)
  }

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-3 py-2 border border-fluent-blue/30 transition-colors">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          onBlur={submit}
          placeholder="输入待办内容，按 Enter 添加..."
          className="flex-1 bg-transparent text-xs text-white/92 placeholder:text-white/60 outline-none"
        />
        <button onClick={submit}
          className="text-[10px] text-white/72 hover:text-white/72 transition-colors">
          <i className="fa-solid fa-plus" />
        </button>
      </div>
    </div>
  )
}

export default TodoList
