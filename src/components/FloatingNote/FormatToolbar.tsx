import React, { useEffect, useRef } from 'react'

interface FormatToolbarProps {
  x: number
  y: number
  visible: boolean
  containerEl: HTMLElement | null
  onClose: () => void
}

interface ToolBtn {
  icon: string
  label: string
  cmd: string
  val?: string
  active?: (doc: Document) => boolean
}

const TOOLS: ToolBtn[] = [
  { icon: 'fa-bold', label: '加粗', cmd: 'bold', active: d => d.queryCommandState('bold') },
  { icon: 'fa-italic', label: '斜体', cmd: 'italic', active: d => d.queryCommandState('italic') },
  { icon: 'fa-underline', label: '下划线', cmd: 'underline', active: d => d.queryCommandState('underline') },
  { icon: 'fa-heading', label: '标题', cmd: 'formatBlock', val: 'h1', active: d => d.queryCommandValue('formatBlock') === 'h1' },
  { icon: 'fa-list-ul', label: '列表', cmd: 'insertUnorderedList', active: d => d.queryCommandState('insertUnorderedList') },
  { icon: 'fa-code', label: '代码', cmd: 'insertHTML', val: '<code>$TEXT</code>' },
]

const FormatToolbar: React.FC<FormatToolbarProps> = ({ x, y, visible, containerEl, onClose }) => {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !barRef.current) return
    // Adjust horizontal position to stay within container
    const bar = barRef.current
    const barW = bar.offsetWidth
    const container = containerEl || document.body
    const cRect = container.getBoundingClientRect()
    let adjustedX = x - barW / 2
    if (adjustedX + barW > cRect.right - 8) adjustedX = cRect.right - barW - 8
    if (adjustedX < cRect.left + 8) adjustedX = cRect.left + 8
    bar.style.left = `${adjustedX}px`
    bar.style.top = `${y - 44}px`
  }, [x, y, visible, containerEl])

  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        // Check if click is inside the contenteditable area
        const sel = window.getSelection()
        if (!sel || !sel.rangeCount || !sel.toString().trim()) {
          onClose()
        }
      }
    }
    // Delay to avoid catching the click that triggered the toolbar
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handler)
    }
  }, [visible, onClose])

  const execCmd = (cmd: string, val?: string) => {
    if (cmd === 'insertHTML' && val) {
      const sel = window.getSelection()
      if (!sel || !sel.rangeCount) return
      const text = sel.toString().trim()
      // Escape HTML entities to prevent XSS via execCommand('insertHTML')
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      if (escaped) {
        document.execCommand('insertHTML', false, `<code>${escaped}</code>`)
      } else {
        // Insert inline code placeholder
        document.execCommand('insertHTML', false, '<code>代码</code>')
      }
    } else {
      document.execCommand(cmd, false, val || undefined)
    }
    // Focus back on the editor
    const el = containerEl
    if (el) el.focus()
  }

  if (!visible) return null

  return (
    <div
      ref={barRef}
      className="fixed z-[9999] flex items-center gap-0.5 bg-[rgba(28,28,38,0.95)] border border-white/[0.08] rounded-lg px-1.5 py-1 shadow-2xl backdrop-blur-xl"
      onMouseDown={e => e.preventDefault()}
    >
      {TOOLS.map(t => (
        <button
          key={t.cmd + (t.val || '')}
          onClick={() => execCmd(t.cmd, t.val)}
          className={`w-7 h-7 flex items-center justify-center rounded text-xs transition-all
            ${t.active && t.active(document)
              ? 'text-white bg-white/[0.12]'
              : 'text-white/72 hover:text-white hover:bg-white/[0.06]'
            }`}
          title={t.label}
        >
          <i className={`fa-solid ${t.icon}`} />
        </button>
      ))}
    </div>
  )
}

export default FormatToolbar
