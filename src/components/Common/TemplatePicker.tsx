import React from 'react'
import { useStore } from '../../store/useStore'
import { uid } from '../../utils/helpers'
import { templates, NoteTemplate } from '../../utils/templates'

interface TemplatePickerProps {
  onClose: () => void
}

const TemplatePicker: React.FC<TemplatePickerProps> = ({ onClose }) => {
  const addFloatingNote = useStore(s => s.addFloatingNote)
  const nextZ = useStore(s => s.nextZ)

  const handleSelect = (tmpl: NoteTemplate) => {
    const id = uid()
    addFloatingNote({
      id,
      type: 'text',
      title: tmpl.title,
      content: tmpl.content,
      x: 100 + Math.random() * 80,
      y: 100 + Math.random() * 80,
      width: 320,
      height: 320,
      zIndex: nextZ,
      floated: true,
    })
    const ei = (window as any).electronAPI
    if (ei) {
      ei.createFloatingWindow({ id, screenX: 100 + Math.random() * 80, screenY: 100 + Math.random() * 80, width: 320, height: 320 })
    }
    onClose()
  }

  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-[rgba(22,22,32,0.96)] border border-white/[0.08] rounded-xl py-1 shadow-2xl min-w-[160px] backdrop-blur-xl"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[9px] text-white/35 border-b border-white/[0.04]">选择模板</div>
      {templates.map(tmpl => (
        <button
          key={tmpl.id}
          onClick={() => handleSelect(tmpl)}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-white/82 hover:bg-white/[0.06] hover:text-white/92 transition-colors text-left"
        >
          <i className={`fa-solid ${tmpl.icon} w-3.5 text-center text-[10px] text-white/50`} />
          {tmpl.label}
        </button>
      ))}
    </div>
  )
}

export default TemplatePicker
