import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TodoItem, FloatingNote, Category, CanvasState, AIConfig, ViewMode } from '../types'
import { defaultTodos, defaultCategories, uid } from '../utils/helpers'
import { moveToTrash } from '../utils/trash'

interface PanelState {
  x: number; y: number; pinned: boolean; locked: boolean; opacity: number; color?: string
}

type SortMode = 'created' | 'priority' | 'dueDate' | 'alpha'

interface Store {
  todos: TodoItem[]
  categories: Category[]
  activeCat: string
  floatingNotes: FloatingNote[]
  nextZ: number
  panel: PanelState
  searchQuery: string
  noteSearchQuery: string
  addingTodo: boolean
  lastBackupTime: number
  theme: 'dark' | 'light'
  sortMode: SortMode
  viewMode: ViewMode
  canvasMode: boolean
  canvas: CanvasState
  aiConfig: AIConfig
  focusDuration: number

  setAddingTodo: (v: boolean) => void
  setCategory: (c: string) => void
  addTodo: (text: string, category?: string) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  permanentlyDeleteTodo: (id: string) => void
  setPriority: (id: string, level: 0 | 1 | 2 | undefined) => void
  setDueDate: (id: string, timestamp: number | undefined) => void
  moveTodo: (fromIndex: number, toIndex: number) => void
  moveTodoToPosition: (id: string, insertIdx: number) => void
  moveTodoToCategory: (id: string, category: string) => void
  addCategory: (c: Category) => void
  removeCategory: (id: string) => void
  addFloatingNote: (n: FloatingNote) => void
  updateFloatingNote: (id: string, data: Partial<FloatingNote>) => void
  removeFloatingNote: (id: string) => void
  permanentlyDeleteNote: (id: string) => void
  focusNote: (id: string) => void
  moveNote: (id: string, x: number, y: number) => void
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
  setSortMode: (m: SortMode) => void
  setViewMode: (m: ViewMode) => void
  toggleCanvasMode: () => void
  setCanvas: (c: Partial<CanvasState>) => void
  setAIConfig: (c: Partial<AIConfig>) => void
  setFocusDuration: (minutes: number) => void
  incrementPomodoro: (noteId: string) => void
  incrementRefCount: (id: string) => void
  getNoteById: (id: string) => FloatingNote | undefined
}

const INIT_PANEL_X = () => Math.max((typeof window !== 'undefined' ? window.innerWidth : 1280) - 356, 0)

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      todos: defaultTodos,
      categories: defaultCategories,
      activeCat: 'all',
      floatingNotes: [],
      nextZ: 1,
      panel: { x: INIT_PANEL_X(), y: 16, pinned: false, locked: false, opacity: 1 },
      searchQuery: '',
      noteSearchQuery: '',
      addingTodo: false,
      lastBackupTime: 0,
      theme: 'dark',
      sortMode: 'created' as SortMode,
      viewMode: 'list' as ViewMode,
      canvasMode: false,
      canvas: { offsetX: 0, offsetY: 0, zoom: 1 },
      aiConfig: { enabled: false, apiUrl: 'http://localhost:11434', model: 'qwen2.5-coder:3b' },
      focusDuration: 25,

      setAddingTodo: (v) => set({ addingTodo: v }),

      setCategory: (c) => set({ activeCat: c }),

      addTodo: (text, category) => set(s => ({
        todos: [{ id: uid(), text, done: false, createdAt: Date.now(), sortOrder: Date.now(), category }, ...s.todos]
      })),

      toggleTodo: (id) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done, completedAt: t.done ? undefined : Date.now() } : t)
      })),

      deleteTodo: (id) => set(s => {
        const todo = s.todos.find(t => t.id === id)
        if (todo) {
          moveToTrash({ id, type: 'todo', data: todo, deletedAt: Date.now() })
        }
        return { todos: s.todos.filter(t => t.id !== id) }
      }),

      permanentlyDeleteTodo: (id) => set(s => ({
        todos: s.todos.filter(t => t.id !== id)
      })),

      setPriority: (id, level) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, priority: level } : t)
      })),

      setDueDate: (id, timestamp) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, dueDate: timestamp } : t)
      })),

      moveTodo: (fromIndex, toIndex) => set(s => {
        const active = s.todos.filter(t => !t.done).sort((a, b) => (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt))
        if (fromIndex < 0 || fromIndex >= active.length || toIndex < 0 || toIndex >= active.length) return {}
        const order = active[fromIndex].sortOrder ?? active[fromIndex].createdAt
        const targetOrder = active[toIndex].sortOrder ?? active[toIndex].createdAt
        return {
          todos: s.todos.map(t =>
            t.id === active[fromIndex].id ? { ...t, sortOrder: targetOrder } :
            t.id === active[toIndex].id ? { ...t, sortOrder: order } : t
          ),
        }
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

      addFloatingNote: (n) => set(s => ({
        floatingNotes: [...s.floatingNotes, { ...n, color: n.color || s.panel.color || undefined, createdAt: n.createdAt || Date.now() }],
        nextZ: s.nextZ + 1
      })),
      updateFloatingNote: (id, data) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === id
            ? { ...n, ...data, updatedAt: (data.content !== undefined || data.todos !== undefined) ? Date.now() : (data.updatedAt ?? n.updatedAt) }
            : n
        )
      })),
      removeFloatingNote: (id) => set(s => {
        const note = s.floatingNotes.find(n => n.id === id)
        if (note) {
          moveToTrash({ id, type: 'note', data: note, deletedAt: Date.now() })
        }
        return { floatingNotes: s.floatingNotes.filter(n => n.id !== id) }
      }),

      permanentlyDeleteNote: (id) => set(s => ({
        floatingNotes: s.floatingNotes.filter(n => n.id !== id)
      })),

      focusNote: (id) => set(s => {
        const z = s.nextZ
        return {
          floatingNotes: s.floatingNotes.map(n =>
            n.id === id && !n.pinned ? { ...n, zIndex: z } :
            n.pinned ? { ...n, zIndex: 999999 } : n
          ),
          nextZ: s.floatingNotes.some(n => n.id === id && !n.pinned) ? z + 1 : s.nextZ,
        }
      }),

      moveNote: (id, x, y) => set(s => ({
        floatingNotes: s.floatingNotes.map(n => n.id === id ? { ...n, x, y } : n)
      })),

      setPanelPos: (x, y) => set(s => ({ panel: { ...s.panel, x, y } })),
      togglePanelPin: () => set(s => ({ panel: { ...s.panel, pinned: !s.panel.pinned } })),
      togglePanelLock: () => set(s => ({ panel: { ...s.panel, locked: !s.panel.locked } })),
      setPanelOpacity: (v) => set(s => ({ panel: { ...s.panel, opacity: v } })),
      setPanelColor: (c) => set(s => ({ panel: { ...s.panel, color: c || undefined } })),

      setSearchQuery: (q) => set({ searchQuery: q }),
      setNoteSearchQuery: (q) => set({ noteSearchQuery: q }),
      setLastBackupTime: (t) => set({ lastBackupTime: t }),

      clearDoneTodos: () => set(s => {
        s.todos.filter(t => t.done).forEach(t => moveToTrash({ id: t.id, type: 'todo', data: t, deletedAt: Date.now() }))
        return { todos: s.todos.filter(t => !t.done) }
      }),

      toggleTheme: () => set(s => {
        const next = s.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-theme', next)
        return { theme: next }
      }),

      setSortMode: (m) => set({ sortMode: m }),
      setViewMode: (m) => set({ viewMode: m }),
      toggleCanvasMode: () => set(s => ({ canvasMode: !s.canvasMode })),
      setCanvas: (c) => set(s => ({ canvas: { ...s.canvas, ...c } })),
      setAIConfig: (c) => set(s => ({ aiConfig: { ...s.aiConfig, ...c } })),
      setFocusDuration: (minutes) => set({ focusDuration: minutes }),
      incrementPomodoro: (noteId) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === noteId ? { ...n, pomodoroCompleted: (n.pomodoroCompleted || 0) + 1 } : n
        )
      })),
      incrementRefCount: (id) => set(s => ({
        floatingNotes: s.floatingNotes.map(n =>
          n.id === id ? { ...n, refCount: (n.refCount || 0) + 1 } : n
        )
      })),
      getNoteById: (id) => get().floatingNotes.find(n => n.id === id),
      moveTodoToCategory: (id, category) => set(s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, category } : t)
      })),
    }),
    { name: 'desk-notes-storage' }
  )
)
