import { TodoItem, FloatingNote, Category } from '../types'

interface ExportData {
  todos: TodoItem[]
  categories: Category[]
  floatingNotes: FloatingNote[]
}

/**
 * Generate Markdown export from all notes data
 */
export function exportToMarkdown(data: ExportData): string {
  const lines: string[] = []
  lines.push('# 思忆便签导出')
  lines.push('')
  lines.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`)
  lines.push('')

  // --- Categories used ---
  const usedCatIds = new Set<string>()
  data.todos.forEach(t => { if (t.category) usedCatIds.add(t.category) })
  data.floatingNotes.forEach(n => { if (n.todos) n.todos.forEach(t => { if (t.category) usedCatIds.add(t.category) }) })
  const catMap = new Map(data.categories.map(c => [c.id, c]))

  // --- Todo list section ---
  lines.push('## 📋 待办清单')
  lines.push('')

  const activeTodos = data.todos.filter(t => !t.done)
  const doneTodos = data.todos.filter(t => t.done)

  if (activeTodos.length > 0) {
    lines.push('### 未完成')
    for (const t of activeTodos) {
      const tag = t.category && catMap.has(t.category)
        ? ` [${catMap.get(t.category)!.label}]`
        : ''
      lines.push(`- [ ] ${t.text}${tag}`)
    }
    lines.push('')
  }

  if (doneTodos.length > 0) {
    lines.push('### 已完成')
    for (const t of doneTodos) {
      const tag = t.category && catMap.has(t.category)
        ? ` [${catMap.get(t.category)!.label}]`
        : ''
      lines.push(`- [x] ${t.text}${tag}`)
    }
    lines.push('')
  }

  // --- Floating notes section ---
  lines.push('---')
  lines.push('')
  lines.push('## 📌 浮动便签')
  lines.push('')

  if (data.floatingNotes.length === 0) {
    lines.push('*暂无浮动便签*')
    lines.push('')
  } else {
    for (const n of data.floatingNotes) {
      lines.push(`### ${n.title}`)
      lines.push('')

      if (n.type === 'text') {
        if (n.content) {
          // Strip HTML tags for clean Markdown export
          const text = n.content.replace(/<[^>]*>/g, '').trim()
          if (text) {
            lines.push(text)
            lines.push('')
          }
        }
      } else if (n.type === 'todo' && n.todos && n.todos.length > 0) {
        for (const t of n.todos) {
          lines.push(t.done ? `- [x] ${t.text}` : `- [ ] ${t.text}`)
        }
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

/**
 * Generate JSON export from all notes data
 */
export function exportToJSON(data: ExportData): string {
  return JSON.stringify(
    {
      todos: data.todos,
      categories: data.categories,
      floatingNotes: data.floatingNotes.map(n => ({
        ...n,
        todos: n.todos || [],
      })),
      exportedAt: new Date().toISOString(),
      version: 1,
    },
    null,
    2
  )
}

/**
 * Trigger a file download via the browser
 */
export function downloadAsFile(content: string, filename: string, mimeType: string = 'text/markdown;charset=utf-8') {
  const ei = (window as any).electronAPI
  const isElectron = !!ei

  if (isElectron && ei.showSaveDialog) {
    // Electron: use native save dialog (the dialog sends content back via IPC)
    ei.showSaveDialog({ filename, content, mimeType })
    return
  }

  // Browser: standard download via ObjectURL
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
