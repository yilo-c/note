import React, { useState, useMemo, useCallback } from 'react'
import { useStore } from '../../store/useStore'
import { TodoItem } from '../../types'

const PRIORITY_COLORS: Record<number, string> = { 0: '#f87171', 1: '#fbbf24', 2: '#64748b' }

function formatDueDate(ts: number): string {
  const d = new Date(ts)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}/${day}`
}

function isOverdue(dueDate: number): boolean {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return dueDate < now.getTime()
}

const KanbanBoard: React.FC = () => {
  const { todos, categories, moveTodoToCategory, setViewMode } = useStore()
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [dragOverCardIdx, setDragOverCardIdx] = useState<string | null>(null)

  const filteredTodos = useMemo(() => {
    return todos.filter(t => !t.done)
  }, [todos])

  // Group todos by category
  const columns = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    map.set('__uncat__', [])
    for (const cat of categories) {
      map.set(cat.id, [])
    }
    for (const t of filteredTodos) {
      const key = t.category && map.has(t.category) ? t.category : '__uncat__'
      map.get(key)!.push(t)
    }
    return map
  }, [filteredTodos, categories])

  const handleDragStart = useCallback((e: React.DragEvent, todoId: string) => {
    e.dataTransfer.setData('text/plain', todoId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleColumnDragOver = useCallback((e: React.DragEvent, catId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(catId)
  }, [])

  const handleCardDragOver = useCallback((e: React.DragEvent, todoId: string) => {
    e.preventDefault()
    setDragOverCardIdx(todoId)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetCategory: string) => {
    e.preventDefault()
    setDragOverCol(null)
    setDragOverCardIdx(null)
    const todoId = e.dataTransfer.getData('text/plain')
    const category = targetCategory === '__uncat__' ? undefined : targetCategory
    moveTodoToCategory(todoId, category ?? '')
  }, [moveTodoToCategory])

  const handleDragEnd = useCallback(() => {
    setDragOverCol(null)
    setDragOverCardIdx(null)
  }, [])

  const getCatInfo = (catId: string): { label: string; icon: string; color: string } => {
    if (catId === '__uncat__') return { label: '未分类', icon: '📋', color: '#64748b' }
    const cat = categories.find(c => c.id === catId)
    return cat ? { label: cat.label, icon: cat.icon, color: cat.color } : { label: catId, icon: '📋', color: '#64748b' }
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', minHeight: 0, height: '100%' }}>
      <div className="flex items-center gap-2 px-3 pt-2 pb-1 flex-shrink-0">
        <button
          onClick={() => setViewMode('list')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/80 hover:text-white bg-white/[0.06] hover:bg-white/[0.1] transition-all border border-white/[0.06]"
        >
          <i className="fa-regular fa-arrow-left text-[10px]" />
          返回列表
        </button>
        <span className="text-[10px] text-white/40">看板模式 — 拖拽待办到分类列快速归类</span>
      </div>

      {/* Scroll wrapper: grid 1fr guarantees definite height; overflow auto for both axes */}
      <div style={{ overflow: 'auto', minHeight: 0 }}>
        <div className="flex gap-3 px-3 pb-3" style={{ width: 'max-content', minWidth: '100%', height: '100%' }}>
          {Array.from(columns.entries()).map(([catId, items]) => {
            const info = getCatInfo(catId)
            return (
              <div
                key={catId}
                className={`flex-shrink-0 w-56 flex flex-col rounded-xl border transition-colors ${dragOverCol === catId ? 'border-fluent-blue/40 bg-white/[0.04]' : 'border-white/[0.06] bg-white/[0.02]'}`}
                style={{ height: '100%' }}
                onDragOver={e => handleColumnDragOver(e, catId)}
                onDrop={e => handleDrop(e, catId)}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{info.icon}</span>
                    <span className="text-xs text-white/80 font-medium truncate">{info.label}</span>
                  </div>
                  <span className="text-[10px] text-white/40 flex-shrink-0 ml-2">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2" style={{ minHeight: 0 }}>
                  {items.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-[10px] text-white/20">暂无待办</div>
                  ) : (
                    items.map(t => {
                      const pc = t.priority !== undefined ? PRIORITY_COLORS[t.priority] : undefined
                      const overdue = t.dueDate && isOverdue(t.dueDate)
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={(e: React.DragEvent) => handleDragStart(e, t.id)}
                          onDragOver={(e: React.DragEvent) => handleCardDragOver(e, t.id)}
                          onDragEnd={handleDragEnd}
                          className={`group px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${dragOverCardIdx === t.id ? 'border border-fluent-blue/30 bg-white/[0.04]' : 'border border-transparent hover:bg-white/[0.03]'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0 w-2 h-2 rounded-full"
                              style={{ background: pc ?? 'transparent', border: pc ? 'none' : '1px solid rgba(255,255,255,0.15)' }} />
                            <span className="flex-1 text-xs text-white/87 truncate leading-relaxed">{t.text}</span>
                          </div>
                          {t.dueDate && (
                            <div className="mt-1 pl-4">
                              <span className={`text-[9px] ${overdue ? 'text-red-400' : 'text-white/40'}`}>
                                {overdue ? '⚠ ' : ''}{formatDueDate(t.dueDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default KanbanBoard
