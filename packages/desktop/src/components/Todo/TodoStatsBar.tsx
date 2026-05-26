import React from 'react'

interface TodoStatsBarProps {
  totalCount: number
  subtaskCount: number
  activeCount: number
  doneCount: number
  overdueCount: number
  onClearDone: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const TodoStatsBar: React.FC<TodoStatsBarProps> = ({
  totalCount, subtaskCount, activeCount, doneCount, overdueCount,
  onClearDone, t,
}) => {
  return (
    <div className="flex-1 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-[10px] text-white/50">
        <span>{t('todo.all')} {totalCount}</span>
        {subtaskCount > 0 && <><span className="text-white/20">·</span><span className="text-white/30">{subtaskCount} ↳</span></>}
        <span className="text-white/20">·</span>
        <span>{t('todo.active')} {activeCount}</span>
        <span className="text-white/20">·</span>
        <span>{t('todo.completed')} {doneCount}</span>
        <span className="text-white/20">·</span>
        <span className={overdueCount > 0 ? 'text-red-400' : ''}>{t('todo.overdue')} {overdueCount}</span>
      </div>
      <div className="flex items-center gap-1">
        {doneCount > 0 && (
          <button
            onClick={onClearDone}
            className="text-[9px] text-white/15 hover:text-red-400/60 transition-colors"
          >
            {t('todo.clearCompleted')}
          </button>
        )}
      </div>
    </div>
  )
}

export default TodoStatsBar
