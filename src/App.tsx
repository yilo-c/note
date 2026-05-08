import React, { useEffect } from 'react'
import AcrylicPanel from './components/AcrylicPanel/AcrylicPanel'
import NotesLayer from './components/FloatingNote/NotesLayer'
import FloatingNoteComp from './components/FloatingNote/FloatingNote'
import { useStore } from './store/useStore'
import { scheduleAutoBackup } from './utils/backup'
import { uid } from './utils/helpers'

const ei = (window as any).electronAPI
const isElectron = !!ei
const hash = window.location.hash

const StandaloneNote: React.FC = () => {
  const noteId = hash.replace('#note=', '')
  const note = useStore(s => s.floatingNotes.find(n => n.id === noteId))

  if (!note) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0c0c10] text-white/72 text-xs select-none">
        便签不存在或已被删除
      </div>
    )
  }

  return (
    <div className="w-screen h-screen overflow-hidden select-none" style={{ background: 'transparent' }}>
      <FloatingNoteComp note={note} standalone />
    </div>
  )
}

const MainApp: React.FC = () => {
  const notes = useStore(s => s.floatingNotes)
  const setLastBackupTime = useStore(s => s.setLastBackupTime)

  // Auto backup (Feature 2)
  useEffect(() => {
    return scheduleAutoBackup(
      () => useStore.getState(),
      (meta) => setLastBackupTime(meta.timestamp)
    )
  }, [setLastBackupTime])

  // Browser mode shortcut hint
  useEffect(() => {
    if (isElectron) return
    const handler = (e: KeyboardEvent) => {
      if ((e.altKey && e.key === 'n') || (e.altKey && e.key === 't') || (e.altKey && e.shiftKey && e.key === 'H')) {
        e.preventDefault()
        const msg = document.createElement('div')
        msg.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-[rgba(18,18,28,0.96)] border border-white/[0.08] rounded-xl px-4 py-2 shadow-2xl text-xs text-white/72 backdrop-blur-xl'
        msg.textContent = '⌨️ 快捷键 (Alt+N / Alt+T / Alt+Shift+H) 仅在桌面版可用'
        document.body.appendChild(msg)
        setTimeout(() => msg.remove(), 3000)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Auto-scan reference links count
  useEffect(() => {
    const scanRefs = () => {
      const allNotes = useStore.getState().floatingNotes
      const refCounts = new Map<string, number>()
      for (const n of allNotes) {
        const content = n.content || ''
        const todoTexts = (n.todos || []).map(t => t.text).join(' ')
        const combined = content + ' ' + todoTexts
        const refRegex = /便签:\/\/([a-zA-Z0-9_-]+)/g
        let m
        while ((m = refRegex.exec(combined)) !== null) {
          refCounts.set(m[1], (refCounts.get(m[1]) || 0) + 1)
        }
      }
      // Update ref counts
      let changed = false
      for (const n of allNotes) {
        const count = refCounts.get(n.id) || 0
        if ((n.refCount || 0) !== count) {
          changed = true
          break
        }
      }
      if (changed) {
        for (const n of allNotes) {
          const count = refCounts.get(n.id) || 0
          useStore.getState().updateFloatingNote(n.id, { refCount: count })
        }
      }
    }
    scanRefs()
    const interval = setInterval(scanRefs, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isElectron) return

    // Auto-create OS windows for notes that were floated (restore previous session)
    const allNotes = useStore.getState().floatingNotes
    let migrated = false
    for (const n of allNotes) {
      if (n.floated === undefined) {
        // First launch after update — mark old notes as non-floated (stay in sidebar)
        useStore.getState().updateFloatingNote(n.id, { floated: false })
        migrated = true
      }
      if (n.floated) {
        ei.createFloatingWindow({
          id: n.id, screenX: n.x, screenY: n.y,
          width: n.width, height: n.height,
        })
      }
    }

    // Global shortcuts
    if (ei.onGlobalShortcut) {
      ei.onGlobalShortcut((data: { action: string }) => {
        if (data.action === 'new-note') {
          const id = uid()
          useStore.getState().addFloatingNote({
            id, type: 'text', title: '📝 新便签', content: '',
            x: 100 + Math.random() * 80, y: 100 + Math.random() * 80,
            width: 260, height: 200, zIndex: useStore.getState().nextZ,
          })
        } else if (data.action === 'new-todo') {
          useStore.getState().setAddingTodo(true)
        }
      })
    }

    // When a floated note's OS window is closed, un-float it back to NotesLayer
    if (ei.onNoteReturned) {
      ei.onNoteReturned((data: { id: string }) => {
        const note = useStore.getState().floatingNotes.find(n => n.id === data.id)
        if (note) {
          useStore.getState().updateFloatingNote(data.id, { floated: false })
        }
      })
    }
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden select-none" style={{ background: isElectron ? 'transparent' : '#0c0c10' }}>
      {/* Desktop gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-gradient-to-br from-fluent-blue/[0.02] to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[40%] h-[30%] bg-gradient-to-tr from-fluent-purple/[0.02] to-transparent rounded-full blur-[100px]" />
      </div>

      {/* Floating notes layer — hidden in Electron (notes use OS windows) */}
      {!isElectron && <NotesLayer />}

      {/* Main acrylic sidebar panel */}
      <AcrylicPanel />
    </div>
  )
}

const App: React.FC = () => {
  if (isElectron && hash.startsWith('#note=')) {
    return <StandaloneNote />
  }
  return <MainApp />
}

export default App
