import React, { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  icon?: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

const ContextMenu: React.FC<Props> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Auto-adjust position so menu doesn't overflow viewport
    const rect = el.getBoundingClientRect()
    const maxX = window.innerWidth
    const maxY = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    if (x + rect.width > maxX) adjustedX = maxX - rect.width - 8
    if (y + rect.height > maxY) adjustedY = maxY - rect.height - 8
    if (adjustedX < 8) adjustedX = 8
    if (adjustedY < 8) adjustedY = 8

    if (adjustedX !== x || adjustedY !== y) {
      el.style.left = `${adjustedX}px`
      el.style.top = `${adjustedY}px`
    }

    // Define listeners outside setTimeout so they're accessible for cleanup
    const onMouseDown = (e: MouseEvent) => {
      if (el && !el.contains(e.target as Node)) {
        onClose()
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    // Defer attaching listeners to avoid catching the same click that opened the menu
    const closeHandler = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown)
      document.addEventListener('keydown', onKeyDown)
    }, 0)

    return () => {
      clearTimeout(closeHandler)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [x, y, onClose])

  return (
    <div
      ref={ref}
      className="fixed z-[10000] min-w-[160px] bg-[rgba(22,22,32,0.96)] border border-white/[0.08] rounded-xl py-1 shadow-2xl backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left
            ${item.disabled ? 'text-white/30 cursor-not-allowed' :
              item.danger
                ? 'text-red-400/80 hover:bg-red-500/10 hover:text-red-400'
                : 'text-white/82 hover:bg-white/[0.06] hover:text-white/92'
            }`}
        >
          {item.icon && <i className={`fa-regular ${item.icon} w-3.5 text-center text-[10px] ${item.disabled ? 'opacity-40' : ''}`} />}
          <span className="flex-1">{item.label}</span>
          {item.shortcut && (
            <span className="text-[9px] text-white/30 ml-4">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default ContextMenu
