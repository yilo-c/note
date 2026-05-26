import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TodoItem, FloatingNote, Category, CanvasState, AIConfig, AIConfigProfile, ViewMode, CustomTheme, Folder, UserProfile, QimenEvent } from '../types'
import { defaultTodos, defaultCategories, uid } from '../utils/helpers'
import type { SupportedLocale } from '../i18n'
import { getAIProvider } from '../utils/ai'
import { getDescendantIds } from './helpers'
import { getPlatformStorage } from './storage'

// ── Injectable trash handler (platform-specific) ──────────────────────────
type TrashPayload = { id: string; type: 'note' | 'todo'; data: unknown; deletedAt: number }
let _trashHandler: (item: TrashPayload) => void = () => {}
export function setTrashHandler(handler: (item: TrashPayload) => void) {
  _trashHandler = handler
}

// ── Platform hint (for partialize) ────────────────────────────────────────
let _isMobile = false
export function setPlatformMobile(v = true) { _isMobile = v }

interface PanelState {
  x: number; y: number; pinned: boolean; locked: boolean; opacity: number; color?: string
}

type SortMode = 'created' | 'priority' | 'dueDate' | 'alpha'

interface Store {
  todos: TodoItem[]
  categories: Category[]
  activeCat: string
  floatingNotes: FloatingNote[]
  folders: Folder[]
  activeFolderId: string | null
  nextZ: number
  panel: PanelState
  searchQuery: string
  noteSearchQuery: string
  addingTodo: boolean
  lastBackupTime: number
  theme: 'dark' | 'black' | 'light'
  referenceMode: 'simple' | 'full'
  defaultReminder: number
  sortMode: SortMode
  viewMode: ViewMode
  canvasMode: boolean
  notesViewMode: 'canvas' | 'list'
  canvas: CanvasState
  aiConfig: AIConfig
  aiProfiles: AIConfigProfile[]
  activeProfileId: string | null
  focusDuration: number
  pomodoroSessionCount: number
  backgroundMode: 'acrylic' | 'pure-white' | 'pure-black'
  locale: SupportedLocale
  savedThemes: CustomTheme[]
  activeThemeId: string | null
  defaultTemplateId: string | null
  searchHighlight: { keyword: string; noteId: string } | null
  filterStatus: 'all' | 'active' | 'completed' | 'overdue'
  filterPriority: number[]
  appPin: string | null
  appLocked: boolean
  panelMode: 'todo' | 'notes'
  editingNoteId: string | null
  userProfile: UserProfile

  /** 从主列表导航到日历奇门 */
  qimenNavigationTarget: { todoId?: string; domain?: string; scenario?: string; text?: string } | null

  /** 初始化状态机 */
  bootPhase: 'idle' | 'booting' | 'ready' | 'failed'
  bootError: string | null

  /** AI 建议的标签（用户确认后才写入） */
  suggestedTags: Record<string, string[]>

  setAddingTodo: (v: boolean) => void
  setUserProfile: (profile: Partial<UserProfile>) => void
  setCategory: (c: string) => void
  addTodo: (text: string, category?: string) => void
  addSubtask: (parentId: string, text: string) => void
  editTodo: (id: string, text: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  permanentlyDeleteTodo: (id: string) => void
  setPriority: (id: string, level: 0 | 1 | 2 | undefined) => void
  setDueDate: (id: string, timestamp: number | undefined) => void
  setRepeatInterval: (id: string, interval: number | undefined) => void
  setQimenEvent: (id: string, qimenEvent: QimenEvent | undefined) => void
  setReminderTime: (id: string, timestamp: number | undefined) => void
  snoozeReminder: (id: string, minutes: number) => void
  clearReminder: (id: string) => void
  moveTodo: (fromIndex: number, toIndex: number) => void
  moveTodoToPosition: (id: string, insertIdx: number) => void
  moveTodoToCategory: (id: string, category: string) => void
  reorderTodoInCategory: (todoId: string, targetCategory: string, targetCardId: string | null) => void
  addCategory: (c: Category) => void
  removeCategory: (id: string) => void
  renameCategory: (id: string, label: string) => void
  /** Batch operations */
  batchDeleteTodos: (ids: string[]) => void
  batchToggleTodos: (ids: string[], done: boolean) => void
  batchSetPriority: (ids: string[], level: 0 | 1 | 2 | undefined) => void
  batchDeleteNotes: (ids: string[]) => void
  batchArchiveNotes: (ids: string[], archived: boolean) => void
  batchMoveNotesToFolder: (ids: string[], folderId: string | null) => void
  addFloatingNote: (n: FloatingNote) => void
  updateFloatingNote: (id: string, data: Partial<FloatingNote>) => void
  removeFloatingNote: (id: string) => void
  permanentlyDeleteNote: (id: string) => void
  focusNote: (id: string) => void
  moveNote: (id: string, x: number, y: number) => void
  setActiveFolder: (id: string | null) => void
  addFolder: (name: string, parentId?: string) => string
  removeFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
  moveNoteToFolder: (noteId: string, folderId: string | null) => void
  setPanelPos: (x: number, y: number) => void
  togglePanelPin: () => void
  togglePanelLock: () => void
  setPanelOpacity: (v: number) => void
  setPanelColor: (c: string | undefined) => void
  setSearchQuery: (q: string) => void
  setNoteSearchQuery: (q: string) => void
  setLastBackupTime: (t: number) => void
  clearDoneTodos: () => void
  toggleTheme: () => void
  setTheme: (t: 'dark' | 'black' | 'light') => void
  setReferenceMode: (m: 'simple' | 'full') => void
  setDefaultReminder: (m: number) => void
  setSortMode: (m: SortMode) => void
  setViewMode: (m: ViewMode) => void
  toggleCanvasMode: () => void
  setNotesViewMode: (m: 'canvas' | 'list') => void
  setCanvas: (c: Partial<CanvasState>) => void
  setBackgroundMode: (m: 'acrylic' | 'pure-white' | 'pure-black') => void
  setLocale: (locale: SupportedLocale) => void
  setAIConfig: (c: Partial<AIConfig>) => void
  addAIProfile: (profile: AIConfigProfile) => void
  updateAIProfile: (id: string, data: Partial<AIConfigProfile>) => void
  deleteAIProfile: (id: string) => void
  setActiveProfileId: (id: string | null) => void
  setFocusDuration: (minutes: number) => void
  incrementPomodoro: (noteId: string) => void
  incrementPomodoroSession: () => void
  resetPomodoroSession: () => void
  incrementRefCount: (id: string) => void
  getNoteById: (id: string) => FloatingNote | undefined
  loadNotesFromDisk: () => Promise<void>
  saveTheme: (name: string, colors: CustomTheme['colors']) => void
  deleteTheme: (id: string) => void
  setActiveTheme: (id: string | null) => void
  setSearchHighlight: (val: { keyword: string; noteId: string } | null) => void
  setDefaultTemplateId: (id: string | null) => void
  setEditingNoteId: (id: string | null) => void
  setPanelMode: (mode: 'todo' | 'notes') => void
  setFilterStatus: (s: 'all' | 'active' | 'completed' | 'overdue') => void
  setFilterPriority: (p: number[]) => void
  toggleFilterPriority: (p: number) => void
  setQimenNavigationTarget: (target: { todoId?: string; domain?: string; scenario?: string; text?: string } | null) => void
  setAppPin: (pin: string | null) => void
  lockApp: () => void
  unlockApp: () => void
  setSuggestedTags: (noteId: string, tags: string[]) => void
  acceptSuggestedTags: (noteId: string) => void
}

const INIT_PANEL_X = () => Math.max((typeof window !== 'undefined' ? window.innerWidth : 1280) - 356, 0)

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      todos: defaultTodos,
      categories: defaultCategories,
      activeCat: 'all',
      floatingNotes: [{
        id: uid(),
        type: 'text',
        title: '📖 思忆便签使用指南',
        content: `# 📖 思忆便签使用指南

欢迎使用 **思忆便签** — 一款轻量级、全功能的桌面便签与待办管理工具。

---

## 🗒️ 笔记功能

- **新建笔记**：点击底部工具栏的「新建笔记」按钮，或在笔记面板点击「+」
- **Markdown 编辑**：支持完整的 Markdown 语法（标题、列表、表格、代码块等）
- **富文本编辑**：通过格式工具栏可切换富文本/Markdown 模式，支持加粗、斜体、列表、引用等
- **Wiki 链接**：使用 \`[[笔记标题]]\` 语法创建笔记之间的双向链接
- **图片插入**：支持粘贴或拖拽图片嵌入笔记，可调整尺寸和对齐方式
- **AI 写作辅助**：选中文本后弹出 AI 工具栏，支持润色、翻译、续写、总结、整理
- **版本历史**：保存笔记快照，可查看差异并回退到历史版本
- **标签管理**：为笔记添加标签，便于分类筛选
- **笔记导出**：支持导出为 Markdown、JSON 或完整备份

## ✅ 待办管理

- **新建待办**：点击底部工具栏的「新建待办」按钮
- **分类管理**：创建自定义分类，拖拽待办到分类卡片
- **优先级**：设置 P0/P1/P2 优先级
- **截止日期**：为待办设置截止日期，超过日期自动标记为逾期
- **重复周期**：支持每日/每周/每月重复的周期性待办
- **子任务**：在待办下添加子任务，逐步完成复杂事项
- **视图模式**：支持列表、看板、日历三种视图
- **搜索筛选**：支持关键词搜索、按状态/优先级筛选
- **奇门遁甲分析**：右键待办可进行奇门遁甲择时分析

## 📅 日历视图

- **月视图/周视图**：切换日历显示粒度
- **拖拽设置日期**：将待办拖拽到日历日期上快速设置截止日
- **智能简报**：显示当日待办统计（待办数、逾期数、高优先级）
- **农历显示**：自动显示当日农历日期和节气
- **黄历宜忌**：查看今日黄历宜忌信息
- **八字命理**：填写出生信息后查看当日八字分析和综合建议
- **奇门遁甲**：支持分领域的奇门遁甲占卜分析，含吉方、吉时、策略建议

## 🤖 AI 功能

- **AI 设置**：支持 Ollama 本地模型和 OpenAI 兼容 API
- **AI 对话**：内置 AI 聊天面板，可切换不同模型预设
- **AI 整理**：笔记内容混乱时，一键 AI 整理排版
- **自动标签**：启用后 AI 自动为笔记建议标签
- **智能搜索**：支持自然语言提问，AI 检索笔记后给出回答

## 🎨 个性化定制

- **主题切换**：深色/黑色/浅色三种主题
- **背景模式**：亚克力模糊 / 纯白 / 纯黑
- **自定义主题**：创建并保存自己的配色主题
- **笔记颜色**：为每条便签设置独立的颜色标识
- **透明度调节**：调整便签窗口的透明度
- **字体大小**：自由调节编辑区域的字体大小

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| Alt + N | 新建笔记 |
| Alt + T | 新建待办 |
| Alt + Shift + H | 切换显示/隐藏 |
| Ctrl + Z | 撤销 |
| Ctrl + Shift + Z | 重做 |

## 📦 数据管理

- **导入**：支持 .md / .json / .txt / .todo 格式导入
- **导出备份**：一键导出全部笔记和待办的 JSON 备份
- **回收站**：删除的笔记和待办进入回收站，可恢复或永久删除
- **自动备份**：桌面版自动备份笔记到本地文件系统

---

> 思忆便签 — 记录灵感，管理生活。
> 如有问题或建议，欢迎在 GitHub 提交 Issue。`,
        x: 80,
        y: 80,
        width: 520,
        height: 600,
        zIndex: 1,
        pinned: false,
        createdAt: Date.now(),
      }],
      folders: [{ id: 'default', name: '全部笔记', sortOrder: 0, createdAt: Date.now() }],
      activeFolderId: null,
      nextZ: 1,
      panel: { x: INIT_PANEL_X(), y: 16, pinned: false, locked: false, opacity: 1 },
      searchQuery: '',
      noteSearchQuery: '',
      addingTodo: false,
      lastBackupTime: 0,
      theme: 'dark',
      referenceMode: 'full',
      defaultReminder: 15,
      sortMode: 'created' as SortMode,
      viewMode: 'list' as ViewMode,
      canvasMode: false,
      notesViewMode: 'canvas',
      canvas: { offsetX: 0, offsetY: 0, zoom: 1 },
      aiConfig: { enabled: true, apiUrl: 'http://localhost:11434', model: 'qwen2.5-coder:3b', protocol: 'ollama', autoTagging: false },
      aiProfiles: [],
      activeProfileId: null,
      focusDuration: 25,
      pomodoroSessionCount: 0,
      backgroundMode: 'acrylic',
      locale: 'zh-CN' as SupportedLocale,
      savedThemes: [],
      activeThemeId: null,
      searchHighlight: null,
      defaultTemplateId: null,
      filterStatus: 'all' as const,
      filterPriority: [],
      appPin: null,
      appLocked: false,
      panelMode: 'todo',
      editingNoteId: null,
      userProfile: { birthDate: null, birthHour: null, gender: null, city: '' },
      qimenNavigationTarget: null,
      bootPhase: 'idle',
      bootError: null,

      setAddingTodo: (v) => set({ addingTodo: v }),

      setCategory: (c) => set({ activeCat: c }),

      addTodo: (text, category) => set(s => ({
        todos: [{ id: uid(), text, done: false, createdAt: Date.now(), sortOrder: Date.now(), category }, ...s.todos]
      })),

      addSubtask: (parentId, text) => set(s => {
        const parent = s.todos.find(t => t.id === parentId)
        return {
          todos: [{
            id: uid(), text, done: false, createdAt: Date.now(),
            sortOrder: Date.now(), category: parent?.category, parentId,
          }, ...s.todos]
        }
      }),

      editTodo: (id, text) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, text } : t)
      })),

      toggleTodo: (id) => set(s => {
        const todo = s.todos.find(t => t.id === id)
        if (!todo) return {}
        // Recurring todo: when marking done, create a new copy with updated due date
        if (!todo.done && todo.repeatInterval) {
          const intervalMs = todo.repeatInterval * 24 * 60 * 60 * 1000
          const newDueDate = todo.dueDate
            ? todo.dueDate + intervalMs
            : Date.now() + intervalMs
          return {
            todos: [{ ...todo, id: uid(), done: false, createdAt: todo.createdAt, sortOrder: Date.now(), dueDate: newDueDate }, ...s.todos.map(t => t.id === id ? { ...t, done: true, completedAt: Date.now() } : t)]
          }
        }
        return { todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() } : t) }
      }),

      deleteTodo: (id) => {
        const toDelete: string[] = [id, ...getDescendantIds(get().todos, id)]
        for (const delId of toDelete) {
          const todo = get().todos.find(t => t.id === delId)
          if (todo) _trashHandler({ id: delId, type: 'todo', data: todo, deletedAt: Date.now() })
        }
        set(s => ({ todos: s.todos.filter(t => !toDelete.includes(t.id)) }))
      },

      batchDeleteTodos: (ids) => {
        const allIds = new Set<string>()
        for (const id of ids) {
          const idsToDel = [id, ...getDescendantIds(get().todos, id)]
          idsToDel.forEach(did => allIds.add(did))
        }
        for (const delId of allIds) {
          const todo = get().todos.find(t => t.id === delId)
          if (todo) _trashHandler({ id: delId, type: 'todo', data: todo, deletedAt: Date.now() })
        }
        set(s => ({ todos: s.todos.filter(t => !allIds.has(t.id)) }))
      },

      batchToggleTodos: (ids, done) => set(s => {
        const idSet = new Set(ids)
        return { todos: s.todos.map(t =>
          idSet.has(t.id) ? { ...t, done, completedAt: done ? Date.now() : undefined } : t
        )}
      }),

      batchSetPriority: (ids, level) => set(s => {
        const idSet = new Set(ids)
        return { todos: s.todos.map(t =>
          idSet.has(t.id) ? { ...t, priority: level } : t
        )}
      }),

      batchDeleteNotes: (ids) => {
        const idSet = new Set(ids)
        for (const id of ids) {
          const note = get().floatingNotes.find(n => n.id === id)
          if (note) _trashHandler({ id, type: 'note', data: note, deletedAt: Date.now() })
        }
        set(s => ({ floatingNotes: s.floatingNotes.filter(n => !idSet.has(n.id)) }))
      },

      batchArchiveNotes: (ids, archived) => set(s => {
        const idSet = new Set(ids)
        return { floatingNotes: s.floatingNotes.map(n =>
          idSet.has(n.id) ? { ...n, archived } : n
        )}
      }),

      batchMoveNotesToFolder: (ids, folderId) => set(s => {
        const idSet = new Set(ids)
        return { floatingNotes: s.floatingNotes.map(n =>
          idSet.has(n.id) ? { ...n, folderId: folderId || undefined } : n
        )}
      }),

      permanentlyDeleteTodo: (id) => {
        const toDelete: string[] = [id, ...getDescendantIds(get().todos, id)]
        set(s => ({ todos: s.todos.filter(t => !toDelete.includes(t.id)) }))
      },

      setPriority: (id, level) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, priority: level } : t)
      })),

      setDueDate: (id, timestamp) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, dueDate: timestamp } : t)
      })),

      setRepeatInterval: (id, interval) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, repeatInterval: interval } : t)
      })),

      setQimenEvent: (id, qimenEvent) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, qimenEvent } : t)
      })),

      setReminderTime: (id, timestamp) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, reminderTime: timestamp, reminderSnoozedUntil: undefined } : t)
      })),

      snoozeReminder: (id, minutes) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, reminderSnoozedUntil: Date.now() + minutes * 60000 } : t)
      })),

      clearReminder: (id) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, reminderTime: undefined, reminderSnoozedUntil: undefined } : t)
      })),

      moveTodo: (fromIndex, toIndex) => set(s => {
        const active = s.todos.filter(t => !t.done)
          .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
        if (fromIndex < 0 || fromIndex >= active.length || toIndex < 0 || toIndex >= active.length) return {}
        if (fromIndex === toIndex) return {}
        const target = active[fromIndex]
        const rest = active.filter(t => t.id !== target.id)
        const clamped = Math.max(0, Math.min(toIndex, rest.length))
        let newSortOrder: number
        if (clamped <= 0) {
          newSortOrder = (rest[0].sortOrder ?? rest[0].createdAt) - 1000
        } else if (clamped >= rest.length) {
          newSortOrder = (rest[rest.length - 1].sortOrder ?? rest[rest.length - 1].createdAt) + 1000
        } else {
          const before = rest[clamped - 1]
          const after = rest[clamped]
          newSortOrder = ((before.sortOrder ?? before.createdAt) + (after.sortOrder ?? after.createdAt)) / 2
        }
        return { todos: s.todos.map(t => t.id === target.id ? { ...t, sortOrder: newSortOrder } : t) }
      }),

      moveTodoToPosition: (id, insertIdx) => set(s => {
        const active = s.todos.filter(t => !t.done)
          .sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
        const others = active.filter(t => t.id !== id)
        if (others.length === 0) return {}
        const clamped = Math.max(0, Math.min(insertIdx, others.length))
        let newSortOrder: number
        if (clamped <= 0) {
          newSortOrder = (others[0].sortOrder ?? others[0].createdAt) - 1000
        } else if (clamped >= others.length) {
          newSortOrder = (others[others.length - 1].sortOrder ?? others[others.length - 1].createdAt) + 1000
        } else {
          const before = others[clamped - 1]
          const after = others[clamped]
          newSortOrder = ((before.sortOrder ?? before.createdAt) + (after.sortOrder ?? after.createdAt)) / 2
        }
        return { todos: s.todos.map(t => t.id === id ? { ...t, sortOrder: newSortOrder } : t) }
      }),

      addCategory: (c) => set(s => ({ categories: [...s.categories, c] })),
      removeCategory: (id) => set(s => ({
        categories: s.categories.filter(c => c.id !== id),
        todos: s.todos.map(t => t.category === id ? { ...t, category: undefined } : t),
      })),
      renameCategory: (id, label) => set(s => ({
        categories: s.categories.map(c => c.id === id ? { ...c, label } : c),
      })),

      addFloatingNote: (n) => set(s => ({
        floatingNotes: [...s.floatingNotes, {
          ...n,
          zIndex: n.zIndex ?? s.nextZ,
          color: n.color ?? s.panel.color ?? undefined,
          createdAt: n.createdAt ?? Date.now(),
        }],
        nextZ: s.nextZ + 1
      })),
      updateFloatingNote: (id, data) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === id
            ? { ...n, ...data, updatedAt: (data.content !== undefined || data.todos !== undefined) ? Date.now() : (data.updatedAt ?? n.updatedAt) }
            : n
        )
      })),
      removeFloatingNote: (id) => {
        const note = get().floatingNotes.find(n => n.id === id)
        if (note) {
          _trashHandler({ id, type: 'note', data: note, deletedAt: Date.now() })
        }
        set(s => ({ floatingNotes: s.floatingNotes.filter(n => n.id !== id) }))
      },

      permanentlyDeleteNote: (id) => set(s => ({
        floatingNotes: s.floatingNotes.filter(n => n.id !== id)
      })),

      focusNote: (id) => set(s => {
        const z = s.nextZ
        const target = s.floatingNotes.find(n => n.id === id)
        if (!target) return {}
        if (target.pinned) return {} // pinned notes stay at their zIndex
        return {
          floatingNotes: s.floatingNotes.map(n =>
            n.id === id ? { ...n, zIndex: z } : n
          ),
          nextZ: z + 1,
        }
      }),

      moveNote: (id, x, y) => set(s => ({
        floatingNotes: s.floatingNotes.map(n => n.id === id ? { ...n, x, y } : n)
      })),

      setActiveFolder: (id) => set({ activeFolderId: id }),
      addFolder: (name, parentId) => {
        const id = uid()
        set(s => ({
          folders: [...s.folders, { id, name, parentId, sortOrder: s.folders.length, createdAt: Date.now() }]
        }))
        return id
      },
      removeFolder: (id) => set(s => {
        // Recursively collect all descendant folder IDs
        const collectDescendants = (parentId: string): string[] => {
          const children = s.folders.filter(f => f.parentId === parentId)
          return [
            parentId,
            ...children.flatMap(c => collectDescendants(c.id)),
          ]
        }
        const toRemove = collectDescendants(id)
        return {
          folders: s.folders.filter(f => !toRemove.includes(f.id)),
          activeFolderId: toRemove.includes(s.activeFolderId ?? '') ? null : s.activeFolderId,
          floatingNotes: s.floatingNotes.map(n =>
            toRemove.includes(n.folderId ?? '') ? { ...n, folderId: undefined } : n
          ),
        }
      }),
      renameFolder: (id, name) => set(s => ({
        folders: s.folders.map(f => f.id === id ? { ...f, name } : f)
      })),
      moveNoteToFolder: (noteId, folderId) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === noteId ? { ...n, folderId: folderId || undefined } : n
        )
      })),

      setPanelPos: (x, y) => set(s => ({ panel: { ...s.panel, x, y } })),
      togglePanelPin: () => set(s => ({ panel: { ...s.panel, pinned: !s.panel.pinned } })),
      togglePanelLock: () => set(s => ({ panel: { ...s.panel, locked: !s.panel.locked } })),
      setPanelOpacity: (v) => set(s => ({ panel: { ...s.panel, opacity: v } })),
      setPanelColor: (c) => set(s => ({ panel: { ...s.panel, color: c || undefined } })),

      setSearchQuery: (q) => set({ searchQuery: q }),
      setNoteSearchQuery: (q) => set({ noteSearchQuery: q }),
      setLastBackupTime: (t) => set({ lastBackupTime: t }),

      clearDoneTodos: () => {
        const doneTodos = get().todos.filter(t => t.done)
        const allDoneIds = new Set<string>()
        for (const t of doneTodos) {
          allDoneIds.add(t.id)
          getDescendantIds(get().todos, t.id).forEach(id => allDoneIds.add(id))
        }
        for (const delId of allDoneIds) {
          const todo = get().todos.find(t => t.id === delId)
          if (todo) _trashHandler({ id: delId, type: 'todo', data: todo, deletedAt: Date.now() })
        }
        set(s => ({ todos: s.todos.filter(t => !allDoneIds.has(t.id)) }))
      },

      toggleTheme: () => set(s => {
        const order: Array<'dark' | 'black' | 'light'> = ['dark', 'black', 'light']
        const idx = order.indexOf(s.theme)
        const next = order[(idx + 1) % order.length]
        document.documentElement.setAttribute('data-theme', next)
        return { theme: next }
      }),
      setTheme: (t) => {
        document.documentElement.setAttribute('data-theme', t)
        set({ theme: t })
      },
      setReferenceMode: (m) => set({ referenceMode: m }),
      setDefaultReminder: (m) => set({ defaultReminder: m }),

      setSortMode: (m) => set({ sortMode: m }),
      setViewMode: (m) => set({ viewMode: m }),
      toggleCanvasMode: () => set(s => ({ canvasMode: !s.canvasMode })),
      setNotesViewMode: (m) => set({ notesViewMode: m }),
      setCanvas: (c) => set(s => ({ canvas: { ...s.canvas, ...c } })),
      setAIConfig: (c) => set(s => ({ aiConfig: { ...s.aiConfig, ...c } })),
      addAIProfile: (profile) => set(s => ({
        aiProfiles: [...s.aiProfiles, profile],
        activeProfileId: profile.id,
        aiConfig: { ...s.aiConfig, apiUrl: profile.apiUrl, model: profile.model, protocol: profile.protocol, apiKey: profile.apiKey, strategy: profile.strategy },
      })),
      updateAIProfile: (id, data) => set(s => {
        const updated = s.aiProfiles.map(p => p.id === id ? { ...p, ...data } : p)
        // If updating the active profile, also sync to aiConfig
        if (s.activeProfileId === id) {
          const profile = updated.find(p => p.id === id)
          if (profile) {
            return { aiProfiles: updated, aiConfig: { ...s.aiConfig, apiUrl: profile.apiUrl, model: profile.model, protocol: profile.protocol, apiKey: profile.apiKey, strategy: profile.strategy } }
          }
        }
        return { aiProfiles: updated }
      }),
      deleteAIProfile: (id) => set(s => {
        const filtered = s.aiProfiles.filter(p => p.id !== id)
        const wasActive = s.activeProfileId === id
        return {
          aiProfiles: filtered,
          activeProfileId: wasActive ? (filtered.length > 0 ? filtered[filtered.length - 1].id : null) : s.activeProfileId,
        }
      }),
      setActiveProfileId: (id) => set(s => {
        if (!id) return { activeProfileId: null }
        const profile = s.aiProfiles.find(p => p.id === id)
        if (!profile) return {}
        return {
          activeProfileId: id,
          aiConfig: { ...s.aiConfig, apiUrl: profile.apiUrl, model: profile.model, protocol: profile.protocol, apiKey: profile.apiKey, strategy: profile.strategy },
        }
      }),
      setLocale: (locale) => set({ locale }),
      setBackgroundMode: (m) => set(s => {
        document.documentElement.setAttribute('data-background', m)
        if (m === 'pure-white') {
          document.documentElement.setAttribute('data-theme', 'light')
        } else if (m === 'pure-black') {
          document.documentElement.setAttribute('data-theme', 'dark')
        } else {
          document.documentElement.setAttribute('data-theme', s.theme)
        }
        const ei = (window as unknown as Record<string, unknown>).electronAPI as { sendBackgroundMode?: (m: string) => void } | undefined
        if (ei?.sendBackgroundMode) ei.sendBackgroundMode(m)
        return { backgroundMode: m }
      }),
      setFocusDuration: (minutes) => set({ focusDuration: minutes }),
      incrementPomodoro: (noteId) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === noteId ? { ...n, pomodoroCompleted: (n.pomodoroCompleted || 0) + 1 } : n
        )
      })),
      incrementPomodoroSession: () => set(s => ({ pomodoroSessionCount: s.pomodoroSessionCount + 1 })),
      resetPomodoroSession: () => set({ pomodoroSessionCount: 0 }),
      incrementRefCount: (id) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === id ? { ...n, refCount: (n.refCount || 0) + 1 } : n
        )
      })),
      getNoteById: (id) => get().floatingNotes.find(n => n.id === id),
      moveTodoToCategory: (id, category) => set(s => {
        const childIds = getDescendantIds(s.todos, id)
        return {
          todos: s.todos.map(t =>
            (t.id === id && !t.parentId) || childIds.includes(t.id) ? { ...t, category } : t
          )
        }
      }),
      reorderTodoInCategory: (todoId, targetCategory, targetCardId) => set(s => {
        const colTodos = s.todos.filter(t => {
          if (t.id === todoId) return false
          const tCat = t.category || ''
          return tCat === targetCategory
        }).sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
        const insertIdx = targetCardId
          ? colTodos.findIndex(t => t.id === targetCardId)
          : colTodos.length
        const clamped = Math.max(0, Math.min(insertIdx, colTodos.length))
        let newSortOrder: number
        if (clamped <= 0) {
          newSortOrder = colTodos.length > 0
            ? (colTodos[0].sortOrder ?? colTodos[0].createdAt) - 1000
            : Date.now()
        } else if (clamped >= colTodos.length) {
          newSortOrder = (colTodos[colTodos.length - 1].sortOrder ?? colTodos[colTodos.length - 1].createdAt) + 1000
        } else {
          const before = colTodos[clamped - 1]
          const after = colTodos[clamped]
          newSortOrder = ((before.sortOrder ?? before.createdAt) + (after.sortOrder ?? after.createdAt)) / 2
        }
        const newCategory = targetCategory || undefined
        return {
          todos: s.todos.map(t => t.id === todoId
            ? { ...t, category: newCategory, sortOrder: newSortOrder }
            : t)
        }
      }),
      loadNotesFromDisk: async () => {
        // Platform-specific: override via setLoadNotesHandler or similar
      },
      saveTheme: (name, colors) => set(s => {
        const existing = s.savedThemes.find(t => t.name === name)
        const theme: CustomTheme = {
          id: existing?.id ?? uid(),
          name,
          createdAt: Date.now(),
          colors,
        }
        return {
          savedThemes: existing
            ? s.savedThemes.map(t => t.id === existing.id ? theme : t)
            : [...s.savedThemes, theme],
          activeThemeId: theme.id,
        }
      }),
      deleteTheme: (id) => set(s => ({
        savedThemes: s.savedThemes.filter(t => t.id !== id),
        activeThemeId: s.activeThemeId === id ? null : s.activeThemeId,
      })),
      setActiveTheme: (id) => set(s => ({
        activeThemeId: id,
        panel: id ? s.panel : { ...s.panel, color: undefined },
      })),
      setSearchHighlight: (val) => set({ searchHighlight: val }),
      setPanelMode: (mode) => set({ panelMode: mode }),
      setEditingNoteId: (id) => set({ editingNoteId: id }),
      setDefaultTemplateId: (id) => set({ defaultTemplateId: id }),
      setFilterStatus: (s) => set({ filterStatus: s }),
      setFilterPriority: (p) => set({ filterPriority: p }),
      toggleFilterPriority: (p) => set(s => ({
        filterPriority: s.filterPriority.includes(p)
          ? s.filterPriority.filter(x => x !== p)
          : [...s.filterPriority, p]
      })),
      setQimenNavigationTarget: (target) => set({ qimenNavigationTarget: target }),
      setAppPin: (pin) => set({ appPin: pin }),
      lockApp: () => set({ appLocked: true }),
      unlockApp: () => set({ appLocked: false }),
      suggestedTags: {},
      setSuggestedTags: (noteId, tags) => set(s => ({
        suggestedTags: { ...s.suggestedTags, [noteId]: tags }
      })),
      acceptSuggestedTags: (noteId) => set(s => {
        const tags = s.suggestedTags[noteId]
        if (!tags || tags.length === 0) return s
        const note = s.floatingNotes.find(n => n.id === noteId)
        if (!note) {
          const { [noteId]: _, ...rest } = s.suggestedTags
          return { suggestedTags: rest }
        }
        const merged = [...new Set([...(note.tags || []), ...tags])]
        const { [noteId]: __, ...restTags } = s.suggestedTags
        return {
          floatingNotes: s.floatingNotes.map(n => n.id === noteId ? { ...n, tags: merged } : n),
          suggestedTags: restTags,
        }
      }),
      setUserProfile: (profile) => set(s => ({
        userProfile: { ...s.userProfile, ...profile }
      })),
    }),
    {
      name: 'desk-notes-storage',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        // Clear data on any version < 3 to force fresh start for new build
        if (version < 3) {
          return {} as never
        }
        return persistedState as never
      },
      storage: createJSONStorage(() => getPlatformStorage()),
      partialize: (state) => {
        // Exclude transient UI state from persist
        const { searchHighlight: _sh, addingTodo: _at, appLocked: _al, editingNoteId: _eni, bootPhase: _bp, bootError: _be, qimenNavigationTarget: _qnt, suggestedTags: _st, ...rest } = state as unknown as Record<string, unknown>
        // In Electron, floatingNotes are persisted individually as .md files
        // In browser mode, keep them in the main persist store (localStorage)
        if (typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electronAPI) {
          const { floatingNotes, ...rest2 } = rest
          return rest2 as Record<string, unknown>
        }
        // On mobile, exclude desktop-only fields to keep localStorage lean
        if (_isMobile) {
          const { panel, nextZ, canvasMode, notesViewMode, canvas, backgroundMode, focusDuration, pomodoroSessionCount, savedThemes, activeThemeId, defaultTemplateId, sortMode, viewMode, filterStatus, filterPriority, panelMode, searchQuery, noteSearchQuery, lastBackupTime, ...mobileRest } = rest
          return mobileRest as unknown as Record<string, unknown>
        }
        return rest as unknown as Record<string, unknown>
      },
    }
  )
)

// ── AI auto-tagging (debounced per note) ─────────────────────────────
{
  const tagTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const contentHashes = new Map<string, string>()

  useStore.subscribe((state) => {
    if (!state.aiConfig.enabled || !state.aiConfig.autoTagging) return
    const notes = state.floatingNotes

    // Clean up hashes for deleted notes
    const activeIds = new Set(notes.map(n => n.id))
    for (const id of contentHashes.keys()) {
      if (!activeIds.has(id)) contentHashes.delete(id)
    }

    for (const note of notes) {
      if (!note.content || note.type !== 'text') continue
      const hash = `${note.content}|${note.title}`
      const prev = contentHashes.get(note.id)
      if (prev === hash) continue
      contentHashes.set(note.id, hash)
      // First time seeing this content, skip (not a change)
      if (prev === undefined) continue

      // Content changed — debounce 3s then call AI
      const existing = tagTimers.get(note.id)
      if (existing) clearTimeout(existing)

      const noteId = note.id
      const content = note.content
      const existingTags = note.tags || []

      const timer = setTimeout(async () => {
        tagTimers.delete(noteId)
        try {
          const cfg = useStore.getState().aiConfig
          const tags = await getAIProvider(cfg).suggestTags(content, existingTags)
          if (tags.length > 0) {
            // Write to suggestedTags instead of directly merging — user confirms first
            useStore.getState().setSuggestedTags(noteId, tags)
          }
        } catch {
          // Auto-tagging is best-effort
        }
      }, 3000)
      tagTimers.set(note.id, timer)
    }
  })
}

// ── AI note summary generation (lazy, one per note) ───────────────────────
{
  const summaryQueued = new Set<string>()
  let summaryRunning = false

  useStore.subscribe((state) => {
    if (!state.aiConfig.enabled) return
    for (const note of state.floatingNotes) {
      if (note.type !== 'text' || !note.content || note.summary) continue
      if (summaryQueued.has(note.id)) continue
      summaryQueued.add(note.id)
    }
    processSummaryQueue()
  })

  async function processSummaryQueue() {
    if (summaryRunning) return
    summaryRunning = true
    while (summaryQueued.size > 0) {
      const it = summaryQueued.values().next()
      if (it.done || it.value === undefined) break
      const noteId: string = it.value
      summaryQueued.delete(noteId)
      try {
        const state = useStore.getState()
        const note = state.floatingNotes.find(n => n.id === noteId)
        if (!note || !note.content || note.summary) continue
        const cfg = state.aiConfig
        const plainText = note.content.replace(/<[^>]*>/g, '').trim()
        if (plainText.length < 20) continue
        const summary = await getAIProvider(cfg).processText('summarize', plainText, () => {})
        if (summary && summary.length < 200) {
          useStore.getState().updateFloatingNote(noteId, { summary })
        }
      } catch {
        // Best-effort
      }
    }
    summaryRunning = false
  }
}
