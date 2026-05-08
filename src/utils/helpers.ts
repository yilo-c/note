import { Category, TodoItem, FloatingNote } from '../types'

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/**
 * Format a timestamp for display in note title area.
 * Today → show time (14:30), Yesterday → "昨天", earlier → date (05/08)
 */
export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()

  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  }

  const mm = (date.getMonth() + 1).toString().padStart(2, '0')
  const dd = date.getDate().toString().padStart(2, '0')
  return `${mm}/${dd}`
}

/**
 * Strip HTML tags, keeping only text content.
 * Used for word count and Markdown export.
 */
export function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

/**
 * Count words/characters for the word count display.
 * Returns { count, isChinese } — if mostly Chinese, it's "字", else "字符".
 */
export function countText(text: string): { count: number; label: string } {
  const chineseCount = (text.match(/[一-鿿]/g) || []).length
  const total = text.length
  if (chineseCount > total * 0.3) {
    return { count: total, label: '字' }
  }
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  return { count: words, label: '字符' }
}

/**
 * Linkify bare URLs in HTML content — wraps bare URLs with <a> tags.
 * Avoids re-linking URLs inside existing <a> tags or href attributes.
 */
export function linkifyHtml(html: string): string {
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g
  // Only process text outside HTML tags
  return html.replace(/(<[^>]*>)|(https?:\/\/[^\s<>"']+)/g, (match, tag, url) => {
    if (tag) return tag
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">${url}</a>`
  })
}

/**
 * Sanitize HTML — only allow b, i, u, h1, ul, ol, li, code, a, br, div, p, span tags.
 * Strips all other tags and attributes except href on <a> and style on <a>.
 */
export function sanitizeHtml(html: string): string {
  // First strip all tags except the allowed ones
  const allowedTags = ['b', 'i', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'code', 'pre', 'a', 'br', 'div', 'p', 'span']
  const tagPattern = /<\/?(\w+)([^>]*)>/g
  return html.replace(tagPattern, (full, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase()
    if (!allowedTags.includes(tag)) {
      // Replace the tag with its content (strip tag but keep inner text)
      if (full.startsWith('</')) return ''
      return ''
    }
    // For allowed tags, strip attributes except href and style on <a>
    if (full.startsWith('</')) return full
    if (tag === 'a') {
      const hrefMatch = attrs.match(/href\s*=\s*"([^"]*)"/i)
      const href = hrefMatch ? hrefMatch[1] : ''
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa;text-decoration:underline">`
    }
    return `<${tag}>`
  })
}

export const defaultCategories: Category[] = [
  { id: 'personal', label: '个人', icon: '👤', color: '#60a5fa' },
  { id: 'important', label: '重要', icon: '⭐', color: '#f87171' },
  { id: 'reading', label: '读书', icon: '📖', color: '#34d399' },
  { id: 'schedule', label: '日程', icon: '📅', color: '#fbbf24' },
  { id: 'idea', label: '灵感', icon: '💡', color: '#a78bfa' },
  { id: 'favorite', label: '收藏', icon: '❤️', color: '#fb923c' },
  { id: 'birthday', label: '生日', icon: '🎂', color: '#f472b6' },
]

export const defaultTodos: TodoItem[] = [
  { id: uid(), text: '完成项目演示 PPT 制作', done: false, createdAt: Date.now() - 7200000, category: 'important' },
  { id: uid(), text: '整理本周工作周报', done: true, createdAt: Date.now() - 86400000, category: 'personal' },
  { id: uid(), text: '预约下午3点会议室', done: false, createdAt: Date.now() - 3600000, category: 'schedule' },
  { id: uid(), text: '给设计师反馈修改意见', done: false, createdAt: Date.now() - 1800000, category: 'personal' },
  { id: uid(), text: '更新项目进度看板', done: true, createdAt: Date.now() - 43200000, category: 'important' },
  { id: uid(), text: '阅读《设计模式》第7章', done: false, createdAt: Date.now() - 600000, category: 'reading' },
  { id: uid(), text: '确认周五团建餐厅', done: false, createdAt: Date.now() - 1200000, category: 'schedule' },
]

const now = Date.now()
export const sampleFloatingNotes: FloatingNote[] = [
  {
    id: uid(), type: 'text', title: '📝 会议记录',
    content: '周一站会要点：\n\n1. 后端 API 已完成 80%\n2. 前端需要对接新接口\n3. 周五前完成联调\n\n⚠️ 注意：\n本周五下午有团建活动',
    x: 420, y: 100, width: 280, height: 260, zIndex: 2,
    createdAt: now - 7200000, updatedAt: now - 3600000,
  },
  {
    id: uid(), type: 'todo', title: '📋 开发任务',
    todos: [
      { id: uid(), text: '实现用户认证模块', done: true, createdAt: now - 10800000 },
      { id: uid(), text: '对接支付网关 API', done: false, createdAt: now - 7200000 },
      { id: uid(), text: '编写单元测试', done: false, createdAt: now - 3600000 },
      { id: uid(), text: 'Code Review', done: false, createdAt: now - 1800000 },
    ],
    content: '', x: 750, y: 80, width: 260, height: 240, zIndex: 1,
    createdAt: now - 10800000, updatedAt: now - 1800000,
  },
  {
    id: uid(), type: 'text', title: '💡 产品想法',
    content: '"当用户完成一个任务时，给他一个动画反馈 🎉"\n\n可以考虑在 Todo 完成时添加彩带动画，提升成就感。',
    x: 540, y: 380, width: 240, height: 180, zIndex: 0,
    createdAt: now - 86400000, updatedAt: now - 43200000,
  },
]

/**
 * Convert hex color (#fff or #ffffff) to RGB object.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.replace('#', '')
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16)
    const g = parseInt(s[1] + s[1], 16)
    const b = parseInt(s[2] + s[2], 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
  }
  if (s.length === 6) {
    const r = parseInt(s.slice(0, 2), 16)
    const g = parseInt(s.slice(2, 4), 16)
    const b = parseInt(s.slice(4, 6), 16)
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : { r, g, b }
  }
  return null
}

export const COLOR_PRESETS = [
  { name: '无', color: '' },
  { name: '红', color: '#ef4444' },
  { name: '橙', color: '#f97316' },
  { name: '黄', color: '#eab308' },
  { name: '绿', color: '#22c55e' },
  { name: '青', color: '#06b6d4' },
  { name: '蓝', color: '#3b82f6' },
  { name: '紫', color: '#a855f7' },
  { name: '粉', color: '#ec4899' },
]
