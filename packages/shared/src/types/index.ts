/* ── 奇门遁甲事件类型 ── */
export type QimenDomain = 'career' | 'wealth' | 'relationship' | 'travel' | 'study' | 'life' | 'other'

export interface QimenEvent {
  domain: QimenDomain
  scenario?: string
  description?: string
}

export const QIMEN_DOMAINS = {
  career: { label: '事业', icon: 'fa-briefcase', scenarios: ['jobInterview', 'salary', 'signing', 'bid', 'promotion', 'startup', 'team'] },
  wealth: { label: '求财', icon: 'fa-coins', scenarios: ['invest', 'debt', 'cooperate', 'stock', 'project'] },
  relationship: { label: '感情', icon: 'fa-heart', scenarios: ['date', 'matchmake', 'marry', 'reconcile'] },
  travel: { label: '出行', icon: 'fa-plane', scenarios: ['travel', 'move', 'abroad', 'drive'] },
  study: { label: '学业', icon: 'fa-graduation-cap', scenarios: ['exam', 'schoolInterview', 'school', 'defense'] },
  life: { label: '生活', icon: 'fa-shield-virus', scenarios: ['find', 'lawsuit', 'medical', 'renovate', 'meeting'] },
  other: { label: '其他', icon: 'fa-ellipsis', scenarios: [] },
} as const

export type QimenDomainKey = keyof typeof QIMEN_DOMAINS

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
  parentId?: string
  repeatInterval?: number
  qimenEvent?: QimenEvent
  reminderTime?: number
  reminderSnoozedUntil?: number
}

export interface Folder {
  id: string
  name: string
  parentId?: string
  sortOrder: number
  createdAt: number
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
  folderId?: string
  createdAt?: number
  updatedAt?: number
  refCount?: number
  pomodoroCompleted?: number
  floated?: boolean
  fontSize?: number
  contentViewMode?: 'edit' | 'preview' | 'split'
  editMode?: 'richtext' | 'markdown'
  /** AI 生成的一句话摘要 */
  summary?: string
}

export interface PomodoroState {
  active: boolean
  remaining: number
  startedAt?: number
  completed: number
}

export type ViewMode = 'list' | 'calendar'

export interface CanvasState {
  offsetX: number
  offsetY: number
  zoom: number
}

export interface AIConfig {
  enabled: boolean
  apiUrl: string
  model: string
  protocol: 'ollama' | 'openai'
  apiKey?: string
  autoTagging: boolean
  /** AI strategy: online only, offline rule-based, or hybrid auto-fallback */
  strategy?: 'online' | 'offline' | 'hybrid'
}

/** Saved AI provider profile — multiple profiles can coexist */
export interface AIConfigProfile {
  id: string
  name: string
  apiUrl: string
  model: string
  protocol: 'ollama' | 'openai'
  apiKey?: string
  strategy?: 'online' | 'offline' | 'hybrid'
}

export interface Category {
  id: string
  label: string
  icon: string
  color: string
}

/** 用户八字/命理信息 */
export interface UserProfile {
  /** 公历出生日期（毫秒时间戳） */
  birthDate: number | null
  /** 出生时辰（0-23，null 表示未知） */
  birthHour: number | null
  /** 性别 */
  gender: 'male' | 'female' | null
  /** 所在城市（用于天气定位） */
  city?: string
}

/** A user-saved custom color theme that overrides CSS variables */
export interface CustomTheme {
  id: string
  name: string
  /** ISO timestamp when saved */
  createdAt: number
  colors: {
    panelBg: string
    panelBgSolid: string
    textPrimary: string
    textSecondary: string
    accent: string
    borderColor: string
    bodyBg: string
  }
}
