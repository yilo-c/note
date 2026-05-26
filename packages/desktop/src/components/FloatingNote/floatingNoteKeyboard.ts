export function handleEditorKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'Tab') {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && sel.anchorNode) {
      const el = sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : sel.anchorNode as HTMLElement
      if (el?.closest?.('li')) {
        e.preventDefault()
        if (e.shiftKey) {
          document.execCommand('outdent')
        } else {
          document.execCommand('indent')
        }
        return
      }
    }
    e.preventDefault()
    document.execCommand('insertHTML', false, '    ')
    return
  }

  // Enter on empty list item: break out of list
  if (e.key === 'Enter' && !e.shiftKey) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && sel.anchorNode) {
      const el = sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : sel.anchorNode as HTMLElement
      const li = el?.closest?.('li')
      if (li && (!li.textContent || li.textContent.trim() === '')) {
        e.preventDefault()
        document.execCommand('outdent')
        return
      }
    }
  }

  // Markdown shortcuts on Space
  if (e.key === ' ') {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !sel.anchorNode) return
    const node = sel.anchorNode
    const text = node.textContent || ''
    const lineStart = text.lastIndexOf('\n', sel.anchorOffset) + 1
    const prefix = sel.anchorOffset <= 0 ? '' : text.slice(lineStart, sel.anchorOffset).trim()
    if (!prefix) return

    if (prefix === '#') {
      e.preventDefault()
      document.execCommand('delete')
      document.execCommand('formatBlock', false, 'h1')
      return
    }
    if (prefix === '##') {
      e.preventDefault()
      document.execCommand('delete')
      document.execCommand('delete')
      document.execCommand('formatBlock', false, 'h2')
      return
    }
    if (prefix === '###') {
      e.preventDefault()
      document.execCommand('delete')
      document.execCommand('delete')
      document.execCommand('delete')
      document.execCommand('formatBlock', false, 'h3')
      return
    }
    if (prefix === '>') {
      e.preventDefault()
      document.execCommand('delete')
      document.execCommand('formatBlock', false, 'blockquote')
      return
    }
    if (prefix === '-' || prefix === '*') {
      e.preventDefault()
      document.execCommand('delete')
      document.execCommand('insertUnorderedList', false)
      return
    }
    if (/^\d+$/.test(prefix)) {
      e.preventDefault()
      for (let i = 0; i < prefix.length; i++) document.execCommand('delete')
      document.execCommand('insertOrderedList', false)
      return
    }
  }
}
