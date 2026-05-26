import React, { useState, useMemo, useCallback, useEffect, useRef, Suspense } from 'react'
import { useStore } from '../../store/useStore'
import { TodoItem } from '../../types'
import type { QimenEvent, QimenDomain } from '../../types'
import { useTranslation } from '../../i18n'
import { getHuangli, getDayCellLunarInfo } from '../../utils/astrology'
import type { HuangliData } from '../../utils/astrology'
import { calculateBazi, getDailyGuidance } from '../../utils/astrology'
import type { BaziProfile, DailyGuidance } from '../../utils/astrology'
import { getAIGuidance } from '../../utils/astrology/ai-guidance'
import { fetchWeather } from '../../utils/astrology/weather'
import type { WeatherData } from '../../utils/astrology/weather'
import BaziSettings from './BaziSettings'
import { suggestQimenEvent, getDomainLabel } from '../../utils/astrology/qimenSuggest'
import { isSameDay, getMonthDays, getWeekDays } from './calendarUtils'
import HuangliPanel from './HuangliPanel'
const GuidanceDashboard = React.lazy(() => import('./GuidanceDashboard'))

/** Max festival/tag labels to show in a day cell before truncating */
const MAX_CELL_TAGS = 2

const CalendarView: React.FC = () => {
  const { todos, setDueDate, activeCat, toggleTodo, deleteTodo } = useStore()
  const { t, tArray } = useTranslation()
  const weekdays = tArray('calendar.weekdays')
  const months = tArray('calendar.months')
  const today = new Date()
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState<Date | null>(today)
  const [dragTodoId, setDragTodoId] = useState<string | null>(null)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const days = useMemo(() => getMonthDays(year, month), [year, month])

  // Pre-compute lunar info for all visible days (one map lookup per cell)
  const lunarInfoMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDayCellLunarInfo>>()
    for (const day of days) {
      try { map.set(day.toDateString(), getDayCellLunarInfo(day)) } catch { /* ignore */ }
    }
    return map
  }, [days])

  // Full huangli data for selected date (null if lunar library unavailable)
  const selectedHuangli: HuangliData | null = useMemo(() => {
    if (!selectedDate) return null
    try { return getHuangli(selectedDate) } catch { return null }
  }, [selectedDate])

  // Group todos by date
  const todosByDate = useMemo(() => {
    const map = new Map<string, TodoItem[]>()
    let list = activeCat === 'all' ? todos : todos.filter(t => t.category === activeCat)
    for (const t of list) {
      if (!t.dueDate) continue
      const key = new Date(t.dueDate).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [todos, activeCat])

  const selectedTodos = useMemo(() => {
    if (!selectedDate) return []
    const key = selectedDate.toDateString()
    return todosByDate.get(key) || []
  }, [selectedDate, todosByDate])

  const prevMonth = useCallback(() => {
    if (viewMode === 'week' && selectedDate) {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() - 7)
      setSelectedDate(d)
    } else {
      setViewDate(new Date(year, month - 1, 1))
    }
  }, [year, month, viewMode, selectedDate])

  const nextMonth = useCallback(() => {
    if (viewMode === 'week' && selectedDate) {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() + 7)
      setSelectedDate(d)
    } else {
      setViewDate(new Date(year, month + 1, 1))
    }
  }, [year, month, viewMode, selectedDate])

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, todoId: string) => {
    const dt = e.dataTransfer
    if (!dt) return
    dt.setData('text/plain', todoId)
    dt.effectAllowed = 'move'
    setDragTodoId(todoId)
  }, [])

  // ── Keyboard navigation ──
  const dayCellRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const handleDayKeyDown = useCallback((e: React.KeyboardEvent, day: Date) => {
    let newDate: Date | null = null
    switch (e.key) {
      case 'ArrowLeft':  newDate = new Date(day); newDate.setDate(newDate.getDate() - 1); break
      case 'ArrowRight': newDate = new Date(day); newDate.setDate(newDate.getDate() + 1); break
      case 'ArrowUp':    newDate = new Date(day); newDate.setDate(newDate.getDate() - 7); break
      case 'ArrowDown':  newDate = new Date(day); newDate.setDate(newDate.getDate() + 7); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        setSelectedDate(day)
        return
      default:
        return
    }
    e.preventDefault()
    if (newDate) {
      setSelectedDate(newDate)
      const vd = viewDate
      if (newDate.getMonth() !== vd.getMonth() || newDate.getFullYear() !== vd.getFullYear()) {
        setViewDate(new Date(newDate.getFullYear(), newDate.getMonth(), 1))
      }
      requestAnimationFrame(() => {
        dayCellRefs.current.get(newDate!.toDateString())?.focus()
      })
    }
  }, [setSelectedDate, setViewDate, viewDate])

  const handleDayDrop = useCallback((e: React.DragEvent, day: Date) => {
    e.preventDefault()
    e.stopPropagation()
    const dt = e.dataTransfer
    if (!dt) return
    const todoId = dt.getData('text/plain')
    if (todoId) {
      setDueDate(todoId, day.getTime())
    }
    setDragTodoId(null)
  }, [setDueDate])

  const handleDayDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const removeDueDate = useCallback((todoId: string) => {
    setDueDate(todoId, undefined)
  }, [setDueDate])

  const isCurrentMonth = (day: Date) => day.getMonth() === month

  // Subtask count per todo
  const childCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of todos) {
      if (t.parentId) map.set(t.parentId, (map.get(t.parentId) || 0) + 1)
    }
    return map
  }, [todos])

  // Count todos per day
  const todoCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const [key, items] of todosByDate) {
      const active = items.filter(t => !t.done)
      if (active.length > 0) map.set(key, active.length)
    }
    return map
  }, [todosByDate])

  const [huangliCollapsed, setHuangliCollapsed] = useState(false)
  const [showBaziSettings, setShowBaziSettings] = useState(false)
  const [adviceView, setAdviceView] = useState<'advice' | 'bazi' | 'qimen'>('advice')
  const [qimenEventId, setQimenEventId] = useState<string | null>(null)
  const [qimenContext, setQimenContext] = useState<QimenEvent | null>(null)
  const [aiAdvice, setAiAdvice] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const { userProfile, setUserProfile, aiConfig, qimenNavigationTarget, setQimenNavigationTarget } = useStore()

  // 从主列表导航过来时打开奇门面板
  useEffect(() => {
    if (!qimenNavigationTarget) return
    const target = qimenNavigationTarget
    setQimenNavigationTarget(null)
    if (target.todoId) {
      const todo = todos.find(t => t.id === target.todoId)
      if (todo) {
        handleQimenSelect(todo)
        return
      }
    }
    setQimenEventId(null)
    setQimenContext({
      domain: (target.domain || 'career') as QimenDomain,
      scenario: target.scenario,
      description: target.text || '',
    })
    setAdviceView('qimen')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qimenNavigationTarget])

  // 切换日期时重载 AI 建议 + 获取天气
  useEffect(() => {
    setAiAdvice(null)
    setAiError(null)
    setAiLoading(false)
    aiAbortRef.current?.abort()
    aiAbortRef.current = null

    // 获取当天天气（按需获取，不阻塞）
    fetchWeather().then(w => {
      setWeather(w)
    }).catch(() => {
      setWeather(null)
    })
  }, [selectedDate])

  // 八字命理
  const baziProfile: BaziProfile | null = useMemo(() => {
    if (!userProfile?.birthDate) return null
    const result = calculateBazi(
      new Date(userProfile.birthDate),
      userProfile.birthHour ?? null,
      userProfile.gender ?? null,
    )
    if (!result) console.warn('[CalendarView] calculateBazi returned null (birthDate=%s, birthHour=%s, hasGender=%s)',
      userProfile?.birthDate ? 'set' : 'null',
      userProfile?.birthHour ?? 'null',
      userProfile?.gender ?? 'null')
    return result
  }, [userProfile?.birthDate, userProfile?.birthHour, userProfile?.gender])

  // 每日命理指导（基于选中日期）
  const dailyGuidance: DailyGuidance | null = useMemo(() => {
    if (!selectedDate) return null
    const list = activeCat === 'all' ? todos : todos.filter(t => t.category === activeCat)
    return getDailyGuidance(selectedDate, baziProfile, list)
  }, [selectedDate, baziProfile, todos, activeCat])

  const handleQimenSelect = useCallback((todo: TodoItem) => {
    setQimenEventId(todo.id)
    setQimenContext(null)
    setAdviceView('qimen')
  }, [])

  // 日期快捷按钮 — 主动进入奇门
  const handleQimenQuickEntry = useCallback(() => {
    setQimenEventId(null)
    setQimenContext({ domain: 'career', scenario: undefined, description: '' })
    setAdviceView('qimen')
  }, [])

  // — 点击：有待办 qimenEvent — 选中；无 — 关键词自动推断领域
  const handleQimenBadgeClick = useCallback((e: React.MouseEvent, todo: TodoItem) => {
    e.stopPropagation()
    if (todo.qimenEvent) {
      handleQimenSelect(todo)
    } else {
      const suggested = suggestQimenEvent(todo.text)
      setQimenEventId(null)
      setQimenContext({
        domain: suggested?.domain || 'career',
        scenario: suggested?.scenario,
        description: todo.text,
      })
      setAdviceView('qimen')
    }
  }, [handleQimenSelect])

  // 奇门分析完成后创建待办
  const handleQimenCreateTodo = useCallback((qimenEvent: QimenEvent) => {
    const { addTodo, setQimenEvent, setPriority, todos } = useStore.getState()
    addTodo(
      qimenEvent.description || `【${qimenEvent.domain}】事项`,
      activeCat === 'all' ? undefined : activeCat,
    )
    // 获取刚创建的待办 ID（最新添加的那个）
    const newTodo = useStore.getState().todos.find(t => !todos.includes(t))
    if (newTodo) {
      setQimenEvent(newTodo.id, qimenEvent)
      setPriority(newTodo.id, 1)
    }
  }, [activeCat])

  const handleAIAnalysis = useCallback(async () => {
    if (!selectedDate || !selectedHuangli || aiLoading) return
    aiAbortRef.current?.abort()
    const controller = new AbortController()
    aiAbortRef.current = controller

    setAiAdvice(null)
    setAiError(null)
    setAiLoading(true)

    try {
      const list = activeCat === 'all' ? todos : todos.filter(t => t.category === activeCat)
      const result = await getAIGuidance(
        selectedDate,
        selectedHuangli,
        baziProfile,
        list,
        (text) => setAiAdvice(text),
        aiConfig,
        weather,
      )
      if (!controller.signal.aborted) {
        setAiAdvice(result.text)
        setAiLoading(false)
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setAiError(err instanceof Error ? err.message : t('guidance.aiError'))
        setAiLoading(false)
      }
    }
  }, [selectedDate, selectedHuangli, baziProfile, todos, activeCat, aiLoading])

  return (
    <div className="flex flex-col px-3 py-2 select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button onClick={prevMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-all"
            style={{ color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-chevron-left" />
          </button>
          <button onClick={nextMonth}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-all"
            style={{ color: 'var(--text-secondary)' }}>
            <i className="fa-solid fa-chevron-right" />
          </button>
        </div>
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {viewMode === 'week' && selectedDate
            ? t('calendar.weekLabel', { month: selectedDate.getMonth() + 1, date: selectedDate.getDate() })
            : t('calendar.monthYearFormat', { year, month: months[month] })}
        </span>
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setViewMode('month')}
            className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-all ${
              viewMode === 'month' ? 'bg-white/[0.1] text-white/80' : 'text-white/40 hover:text-white/60'
            }`}>
            {t('calendar.month')}
          </button>
          <button onClick={() => setViewMode('week')}
            className={`px-1.5 py-0.5 rounded text-[8px] font-medium transition-all ${
              viewMode === 'week' ? 'bg-white/[0.1] text-white/80' : 'text-white/40 hover:text-white/60'
            }`}>
            {t('calendar.week')}
          </button>
        </div>
      </div>

      {/* Weekday headers —?month view */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekdays.map((d, i) => (
            <div key={i} className="text-center text-[9px] py-1"
              style={{ color: 'var(--text-dim)' }}>
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Day grid —?month view */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, i) => {
            const key = day.toDateString()
            const count = todoCounts.get(key) || 0
            const isToday = isSameDay(day, today)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const inMonth = isCurrentMonth(day)
            const lunarInfo = lunarInfoMap.get(key)

          // Collect cell tags (solar term first, then festivals)
          const cellTags: string[] = []
          if (lunarInfo?.jieQi) cellTags.push(lunarInfo.jieQi)
          if (lunarInfo?.festivals) {
            for (const f of lunarInfo.festivals) {
              if (cellTags.length >= MAX_CELL_TAGS) break
              cellTags.push(f)
            }
          }

          return (
            <div
              key={i}
              onClick={() => handleDayClick(day)}
              onDrop={(e) => handleDayDrop(e, day)}
              onDragOver={handleDayDragOver}
              onKeyDown={e => handleDayKeyDown(e, day)}
              tabIndex={0}
              ref={el => { if (el) dayCellRefs.current.set(day.toDateString(), el) }}
              className={`relative flex flex-col items-center justify-start py-1 rounded-lg cursor-pointer transition-all min-h-[48px] ${
                !inMonth ? 'opacity-25' : ''
              } ${
                isSelected
                  ? 'bg-fluent-blue/15 ring-1 ring-fluent-blue/30'
                  : 'hover:bg-white/[0.04]'
              }`}
              style={isToday && !isSelected ? { background: 'rgba(96,165,250,0.08)' } : undefined}
            >
              <span className={`text-[10px] leading-none mb-0.5 ${
                isToday ? 'font-bold text-fluent-blue' : ''
              }`}
                style={{ color: isToday ? undefined : 'var(--text-secondary)' }}
              >
                {day.getDate()}
              </span>
              {/* Lunar day + ganZhi */}
              {lunarInfo && lunarInfo.lunarDay && (
                <span className="text-[7px] leading-none mb-0.5" style={{ color: 'var(--text-muted)' }}>
                  {lunarInfo.ganZhiDay} {lunarInfo.lunarDay}
                </span>
              )}
              {/* Todo count */}
              {count > 0 && (
                <span className={`text-[8px] px-1 rounded-full leading-none ${
                  count > 3 ? 'bg-red-500/20 text-red-400' : 'bg-fluent-blue/15 text-fluent-blue/70'
                }`}>
                  {count > 9 ? t('calendar.over9') : count}
                </span>
              )}
              {/* Solar term / festival tags */}
              {cellTags.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                  {cellTags.map((tag, idx) => (
                    <span key={idx}
                      className={`text-[6px] px-1 rounded-sm leading-tight ${
                        lunarInfo?.jieQi === tag
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Drop indicator */}
              {dragTodoId && (
                <div className="absolute inset-0 rounded-lg border-2 border-dashed border-fluent-blue/30 opacity-0 hover:opacity-100 pointer-events-none" />
              )}
            </div>
          )
        })}
      </div>
      )}

      {/* Day grid —?week view */}
      {viewMode === 'week' && selectedDate && (
        <div className="grid grid-cols-7 gap-0.5 mb-2">
          {(() => {
            const wkDays = getWeekDays(selectedDate)
            return wkDays.map((day, i) => {
              const key = day.toDateString()
              const count = todoCounts.get(key) || 0
              const isToday = isSameDay(day, today)
              const isSel = isSameDay(day, selectedDate)
              const lunarInfo = lunarInfoMap.get(key)
              return (
                <div key={i}
                  onClick={() => handleDayClick(day)}
                  onDrop={(e) => handleDayDrop(e, day)}
                  onDragOver={handleDayDragOver}
                  onKeyDown={e => handleDayKeyDown(e, day)}
                  tabIndex={0}
                  ref={el => { if (el) dayCellRefs.current.set(day.toDateString(), el) }}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg cursor-pointer transition-all ${
                    isSel
                      ? 'bg-fluent-blue/15 ring-1 ring-fluent-blue/30'
                      : 'hover:bg-white/[0.04]'
                  }`}
                  style={isToday && !isSel ? { background: 'rgba(96,165,250,0.08)' } : undefined}
                >
                  <span className="text-[7px]" style={{ color: 'var(--text-dim)' }}>
                    {weekdays[i]}
                  </span>
                  <span className={`text-[11px] leading-tight mt-0.5 ${
                    isToday ? 'font-bold text-fluent-blue' : ''
                  }`} style={{ color: isToday ? undefined : 'var(--text-secondary)' }}>
                    {day.getDate()}
                  </span>
                  {lunarInfo?.lunarDay && (
                    <span className="text-[6px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                      {lunarInfo.lunarDay}
                    </span>
                  )}
                  {count > 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(count, 3) }, (_, ci) => (
                        <span key={ci} className="w-1 h-1 rounded-full bg-fluent-blue/40" />
                      ))}
                      {count > 3 && (
                        <span className="text-[6px]" style={{ color: 'var(--text-muted)' }}>+{count - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Selected date: todo list + huangli */}
      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {/* Date header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {selectedDate.toLocaleDateString(
                useStore.getState().locale === 'en' ? 'en-US' : 'zh-CN',
                { month: 'long', day: 'numeric', weekday: 'short' }
              )}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
              {t('calendar.itemsCount', { count: selectedTodos.length })}
            </span>
            {selectedTodos.length === 0 && (
              <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>
                {t('calendar.dropHint')}
              </span>
            )}
          </div>

          {/* Todo list */}
          <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
            {selectedTodos.map(todo => (
              <div key={todo.id}
                draggable
                onDragStart={(e) => handleDragStart(e, todo.id)}
                className="group flex items-center gap-2 px-2 py-1 rounded-lg transition-all cursor-grab active:cursor-grabbing hover:bg-white/[0.04]"
              >
                <button
                  draggable={false}
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all hover:scale-125 ${
                    todo.done ? 'bg-green-400/50' : 'bg-fluent-blue/50'
                  }`}
                  title={todo.done ? t('todo.markUndone') : t('todo.markDone')}
                />
                <span className={`flex-1 text-[10px] truncate ${todo.done ? 'line-through text-white/40' : ''}`}
                  style={{ color: todo.done ? undefined : 'var(--text-secondary)' }}>
                  {todo.text}
                </span>
                {childCounts.has(todo.id) && (
                  <span className="flex-shrink-0 text-[7px] px-1 py-0.5 rounded bg-white/[0.06] text-white/40 leading-none">
                    {childCounts.get(todo.id)}
                  </span>
                )}
                {todo.priority !== undefined && (
                  <span className={`text-[7px] px-1 py-0.5 rounded ${
                    todo.priority === 0 ? 'bg-red-500/15 text-red-400' :
                    todo.priority === 1 ? 'bg-yellow-500/15 text-yellow-400' :
                    'bg-gray-500/15 text-gray-400'
                  }`}>
                    P{todo.priority}
                  </span>
                )}
                {!todo.done && todo.priority !== undefined && todo.priority <= 1 && (
                  <button
                    onClick={(e) => handleQimenBadgeClick(e, todo)}
                    className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded transition-all hover:scale-110 ${
                      todo.qimenEvent
                        ? 'text-purple-400 bg-purple-500/15'
                        : (() => {
                            const s = suggestQimenEvent(todo.text)
                            return s
                              ? 'text-purple-300/50 bg-purple-500/8 hover:text-purple-400 hover:bg-purple-500/15'
                              : 'text-white/20 hover:text-purple-400/60 hover:bg-purple-500/10'
                          })()
                    }`}
                    title={(() => {
                      if (todo.qimenEvent) return t('guidance.qimen')
                      const s = suggestQimenEvent(todo.text)
                      return s ? `${t('guidance.qimen')}·${getDomainLabel(s.domain)}${s.scenario ? `·${s.scenario}` : ''}` : t('guidance.qimenEntryTitle')
                    })()}
                  >
                    </button>
                )}
                <button onClick={() => removeDueDate(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-[9px] transition-all"
                  style={{ color: 'var(--text-dim)' }}
                  title={t('todo.dueDate.remove')}>
                  <i className="fa-solid fa-xmark" />
                </button>
                <button draggable={false} onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-[9px] transition-all hover:text-red-400"
                  style={{ color: 'var(--text-dim)' }}
                  title={t('common.delete')}>
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            ))}
            {selectedTodos.length > 0 && (
              <div className="mt-1 pt-1 border-t border-white/[0.04]">
                <div className="flex items-center gap-2 text-[9px]">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {t('calendar.completedCount')}: {selectedTodos.filter(t => t.done).length}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {t('calendar.pendingCount')}: {selectedTodos.filter(t => !t.done).length}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 奇门起局快捷入口 */}
          <div className="mt-2 pt-2 border-t border-white/[0.04]">
            <button
              onClick={handleQimenQuickEntry}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] transition-all"
              style={{
                background: 'rgba(139,92,246,0.08)',
                color: '#c4b5fd',
                border: '1px dashed rgba(139,92,246,0.2)',
              }}
            >
              <i className="fa-solid fa-compass text-[10px]" />
              {t('guidance.qimen')} · {t('guidance.qimenEntryTitle')}
            </button>
          </div>

          {/* ── 黄历 section ── */}
          {selectedHuangli && (
            <HuangliPanel
              huangli={selectedHuangli}
              collapsed={huangliCollapsed}
              onToggle={() => setHuangliCollapsed(v => !v)}
            />
          )}

          {/* ── 命理指导 dashboard — always mount to preserve tab state */}
          <Suspense fallback={<div className="h-8" />}>
          <GuidanceDashboard
              dailyGuidance={dailyGuidance}
              adviceView={adviceView}
              onAdviceViewChange={setAdviceView}
              baziProfile={baziProfile}
              onOpenBaziSettings={() => setShowBaziSettings(true)}
              weather={weather}
              userProfile={userProfile}
              onSetCity={(city) => setUserProfile({ city })}
              t={t}
              aiAdvice={aiAdvice}
              aiLoading={aiLoading}
              aiError={aiError}
              onAIAnalysis={handleAIAnalysis}
              qimenEventId={qimenEventId}
              qimenContext={qimenContext}
              selectedTodos={selectedTodos}
              onCreateTodo={handleQimenCreateTodo}
            />
          </Suspense>


          {/* 八字设置弹窗 */}
          {showBaziSettings && (
            <BaziSettings onClose={() => setShowBaziSettings(false)} />
          )}
        </div>
      )}
    </div>
  )
}

export default CalendarView

