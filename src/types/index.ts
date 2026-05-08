export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  category?: string
  priority?: 0 | 1 | 2
  dueDate?: number
  sortOrder?: number
  completedAt?: number
}

export interface FloatingNote {
  id: string
  type: 'text' | 'todo'
  title: string
  content: string
  todos?: TodoItem[]
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  opacity?: number
  color?: string
  pinned?: boolean
  locked?: boolean
  collapsed?: boolean
  archived?: boolean
  tags?: string[]
  createdAt?: number
  updatedAt?: number
  refCount?: number
  pomodoroCompleted?: number
  floated?: boolean
}

export interface PomodoroState {
  active: boolean
  remaining: number
  startedAt?: number
  completed: number
}

export type ViewMode = 'list' | 'board'

export interface CanvasState {
  offsetX: number
  offsetY: number
  zoom: number
}

export interface AIConfig {
  enabled: boolean
  apiUrl: string
  model: string
}

export interface Category {
  id: string
  label: string
  icon: string
  color: string
}
