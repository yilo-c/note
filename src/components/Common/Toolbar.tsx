import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { uid } from '../../utils/helpers'
import { exportToMarkdown, exportToJSON, downloadAsFile } from '../../utils/export'
import { downloadBackup } from '../../utils/backup'
import { getBackupMeta } from '../../utils/backup'
import TemplatePicker from './TemplatePicker'

const ei = (window as any).electronAPI
const isElectron = !!ei

const Toolbar: React.FC = () => {
  const { addFloatingNote, nextZ, setAddingTodo, todos, floatingNotes, categories, lastBackupTime } = useStore()
  const [showExport, setShowExport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const templateRef = useRef<HTMLDivElement>(null)

  // Close export/template dropdowns on outside click
  useEffect(() => {
    if (!showExport && !showTemplates) return
    const handler = (e: MouseEvent) => {
      if (showExport && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false)
      }
      if (showTemplates && templateRef.current && !templateRef.current.contains(e.target as Node)) {
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExport, showTemplates])

  const createTextNote = () => {
    const id = uid()
    addFloatingNote({
      id, type: 'text', title: '📝 新便签', content: '',
      x: 100 + Math.random() * 80, y: 100 + Math.random() * 80,
      width: 260, height: 200, zIndex: nextZ, floated: true,
    })
    if (isElectron) {
      ei.createFloatingWindow({ id, screenX: 100 + Math.random() * 80, screenY: 100 + Math.random() * 80, width: 260, height: 200 })
    }
  }

  const createTodoNote = () => {
    setAddingTodo(true)
  }

  const doExportMarkdown = () => {
    const data = { todos, categories, floatingNotes }
    const md = exportToMarkdown(data)
    const ts = new Date().toISOString().slice(0, 10)
    downloadAsFile(md, `思忆便签-${ts}.md`, 'text/markdown;charset=utf-8')
    setShowExport(false)
  }

  const doExportJSON = () => {
    const data = { todos, categories, floatingNotes }
    const json = exportToJSON(data)
    const ts = new Date().toISOString().slice(0, 10)
    downloadAsFile(json, `思忆便签-${ts}.json`, 'application/json;charset=utf-8')
    setShowExport(false)
  }

  const doDownloadBackup = () => {
    downloadBackup()
    setShowExport(false)
  }

  const backupMeta = getBackupMeta()
  const backupTimeStr = backupMeta
    ? new Date(backupMeta.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="flex items-center justify-center gap-2 px-3 py-2.5 border-t border-white/[0.04] bg-white/[0.02]">
      <ToolBtn icon="fa-note-sticky" label="新建文本" onClick={createTextNote} />
      <ToolBtn icon="fa-list-check" label="新建待办" onClick={createTodoNote} />

      {/* Template picker */}
      <div className="relative" ref={templateRef}>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/72 hover:text-white/60 hover:bg-white/[0.05] transition-all text-xs"
        >
          <i className="fa-solid fa-file-lines" />
          <span>模板</span>
        </button>
        {showTemplates && <TemplatePicker onClose={() => setShowTemplates(false)} />}
      </div>

      <div className="w-px h-5 bg-white/[0.06]" />

      {/* Export button with dropdown */}
      <div className="relative" ref={exportRef}>
        <ToolBtn icon="fa-file-export" label="导出" onClick={() => setShowExport(!showExport)} />
        {showExport && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-[rgba(22,22,32,0.96)] border border-white/[0.08] rounded-xl py-1 shadow-2xl min-w-[140px] backdrop-blur-xl">
            <DropItem icon="fa-markdown" label="导出 Markdown" onClick={doExportMarkdown} />
            <DropItem icon="fa-bracket-curly" label="导出 JSON" onClick={doExportJSON} />
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <DropItem icon="fa-floppy-disk" label="下载备份" onClick={doDownloadBackup} />
          </div>
        )}
      </div>

      {/* Backup time indicator */}
      {backupTimeStr && (
        <span className="text-[9px] text-white/20 absolute right-3 bottom-1">
          已备份 {backupTimeStr}
        </span>
      )}
    </div>
  )
}

const ToolBtn: React.FC<{ icon: string; label: string; onClick?: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/72 hover:text-white/60 hover:bg-white/[0.05] transition-all text-xs"
  >
    <i className={`fa-solid ${icon}`} />
    <span>{label}</span>
  </button>
)

const DropItem: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-white/82 hover:bg-white/[0.06] hover:text-white/92 transition-colors text-left"
  >
    <i className={`fa-regular ${icon} w-3.5 text-center text-[10px]`} />
    {label}
  </button>
)

export default Toolbar
