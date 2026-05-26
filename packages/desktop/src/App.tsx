import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react'
import AcrylicPanel from './components/AcrylicPanel/AcrylicPanel'
import NotesLayer from './components/FloatingNote/NotesLayer'
import FloatingNoteComp from './components/FloatingNote/FloatingNote'
import { useStore } from './store/useStore'
import { useTranslation } from './i18n'
import { scheduleAutoBackup } from './utils/backup'
import { uid } from './utils/helpers'
import { undoManager } from './store/undoManager'
import { WIKI_LINK_REGEX, PROTOCOL_LINK_REGEX } from './utils/wikiLinks'
import UndoToast from './components/Common/UndoToast'
import ErrorToast from './components/Common/ErrorToast'
import UpdateNotifier from './components/Common/UpdateNotifier'
import XiaoWenPetAvatar from './components/Pet/XiaoWenPetAvatar'
import { initFileStore } from './utils/fileStore'
import { initTrash } from './utils/trash'
import { applyCustomTheme } from './utils/customTheme'
import { pluginManager } from './utils/pluginSystem'
import { registerBuiltinPlugins } from './plugins/builtins'
import { addAutoSnapshot } from './utils/noteHistory'
import LockScreen from './components/Common/LockScreen'
import InstallPrompt from './components/Common/InstallPrompt'
import ErrorBoundary from './components/Common/ErrorBoundary'
import type { FloatingNote } from './types'

const QuickSearchModal = lazy(() => import('./components/Search/QuickSearchModal'))
const QuickTodoInput = lazy(() => import('./components/Todo/QuickTodoInput'))
const QuickCapture = lazy(() => import('./components/QuickCapture/QuickCapture'))

const ei = window.electronAPI as ElectronAPI | undefined
const isElectron = !!ei
const hash = window.location.hash
const hashParams = new URLSearchParams(hash.replace(/^#/, ''))

const StandaloneNote: React.FC = () => {
  const noteId = hashParams.get('note') || ''
  const note = useStore(s => s.floatingNotes.find(n => n.id === noteId))
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await initFileStore()

        // Load only the single note instead of scanning all .md files
        if (isElectron && ei?.fileStore?.readNote) {
          const noteData = await ei.fileStore.readNote(noteId) as FloatingNote | null
          if (noteData && !cancelled) {
            useStore.setState({ floatingNotes: [noteData] })
          }
        } else {
          await useStore.getState().loadNotesFromDisk()
        }

        if (cancelled) return
        // Sync data-background from store AFTER rehydration,
        // so FloatingNoteComp uses matching CSS variables from the first render
        const mode = useStore.getState().backgroundMode
        document.documentElement.setAttribute('data-background', mode)
        if (mode === 'pure-white') {
          document.documentElement.setAttribute('data-theme', 'light')
        } else if (mode === 'pure-black') {
          document.documentElement.setAttribute('data-theme', 'dark')
        } else {
          document.documentElement.setAttribute('data-theme', useStore.getState().theme)
        }
      } catch (e: unknown) {
        console.error('[StandaloneNote] init failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0c0c10] text-white/48 text-xs select-none">
        {t('common.loading')}
      </div>
    )
  }

  if (!note) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#0c0c10] text-white/72 text-xs select-none">
        {t('common.notFound')}
      </div>
    )
  }

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: 'transparent' }}>
      <FloatingNoteComp note={note} standalone />
    </div>
  )
}

const MainApp: React.FC = () => {
  const setLastBackupTime = useStore(s => s.setLastBackupTime)
  const backgroundMode = useStore(s => s.backgroundMode)
  const activeThemeId = useStore(s => s.activeThemeId)
  const savedThemes = useStore(s => s.savedThemes)
  const appPin = useStore(s => s.appPin)
  const appLocked = useStore(s => s.appLocked)
  const lockApp = useStore(s => s.lockApp)
  const bootPhase = useStore(s => s.bootPhase)
  const bootError = useStore(s => s.bootError)
  const [quickSearchOpen, setQuickSearchOpen] = useState(false)
  const [quickTodoOpen, setQuickTodoOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const { t } = useTranslation()

  // Sync DOM attributes and body background for background mode
  useEffect(() => {
    document.documentElement.setAttribute('data-background', backgroundMode)

    if (backgroundMode === 'pure-white') {
      document.documentElement.setAttribute('data-theme', 'light')
      document.body.style.background = '#ffffff'
      document.documentElement.style.background = '#ffffff'
    } else if (backgroundMode === 'pure-black') {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.body.style.background = '#000000'
      document.documentElement.style.background = '#000000'
    } else if (isElectron) {
      // acrylic mode: restore theme from store
      const currentTheme = useStore.getState().theme
      document.documentElement.setAttribute('data-theme', currentTheme)
      document.body.style.background = 'transparent'
      document.documentElement.style.background = 'transparent'
    } else {
      document.documentElement.setAttribute('data-theme', 'dark')
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [backgroundMode])

  // Apply custom theme when active theme changes
  useEffect(() => {
    const activeTheme = activeThemeId ? savedThemes.find(t => t.id === activeThemeId) ?? null : null
    applyCustomTheme(activeTheme)
  }, [activeThemeId, savedThemes])

  // Expose store for Electron executeJavaScript access
  ;(window as unknown as Record<string, unknown>).__useStore = useStore

  // Initialize file store, load notes, set up Electron (order matters!)
  useEffect(() => {
    let cancelled = false
    let cleanupReminder: (() => void) | null = null
    const cleanupFns: (() => void)[] = []

    // Mark booting before any async work
    useStore.setState({ bootPhase: 'booting', bootError: null })

    ;(async () => {
      try {
        // 1. Init file store (migrate data if needed)
        const result = await initFileStore()
        if (cancelled) return
        if (result.migrated) {
          useStore.persist.rehydrate()
        }
        await initTrash()
        if (cancelled) return

        // Init plugin system
        registerBuiltinPlugins()
        pluginManager.runHook('onAppStart')

        // 2. Load notes from individual .md files into store
        await useStore.getState().loadNotesFromDisk()
        if (cancelled) return

        // 3. Start reminder sync
        const { startReminderSync } = await import('./utils/reminder')
        if (cancelled) return
        cleanupReminder = startReminderSync()

        // 4. Electron-specific setup (notes are now in the store!)
        if (!isElectron || cancelled) return

        // Auto-create OS windows for notes that were floated (restore previous session)
        const allNotes = useStore.getState().floatingNotes
        const startupBgMode = useStore.getState().backgroundMode
        if (ei.sendBackgroundMode) ei.sendBackgroundMode(startupBgMode)
        for (const n of allNotes) {
          if (n.floated === undefined) {
            useStore.getState().updateFloatingNote(n.id, { floated: false })
          }
          if (n.floated) {
            ei.createFloatingWindow({
              id: n.id, screenX: n.x, screenY: n.y,
              width: n.width, height: n.height,
              backgroundMode: startupBgMode,
            })
          }
        }

        // Global shortcuts
        if (ei.onGlobalShortcut) {
          const handler = (data: { action: string; content?: string }) => {
            if (data.action === 'new-note') {
              const id = uid()
              const hasContent = data.content && data.content.trim()
              useStore.getState().addFloatingNote({
                id, type: 'text',
                title: hasContent ? data.content!.slice(0, 30) : t('note.newNote'),
                content: hasContent ? data.content! : '',
                folderId: useStore.getState().activeFolderId || undefined,
                x: 100 + Math.random() * 80, y: 100 + Math.random() * 80,
                width: 260, height: 200, zIndex: useStore.getState().nextZ,
              })
            } else if (data.action === 'new-todo') {
              setQuickTodoOpen(true)
            } else if (data.action === 'quick-search') {
              setQuickSearchOpen(true)
            } else if (data.action === 'quick-capture') {
              setQuickCaptureOpen(true)
            }
          }
          const cleanup = ei.onGlobalShortcut(handler)
          cleanupFns.push(cleanup)
        }

        // When a floated note's OS window is closed, un-float it back to NotesLayer
        if (ei.onNoteReturned) {
          const handler = (data: { id: string }) => {
            const note = useStore.getState().floatingNotes.find(n => n.id === data.id)
            if (note) {
              useStore.getState().updateFloatingNote(data.id, { floated: false })
            }
          }
          const cleanup = ei.onNoteReturned(handler)
          cleanupFns.push(cleanup)
        }

        // Native theme sync from Electron
        if (ei.onNativeThemeChanged) {
          const cleanup = ei.onNativeThemeChanged((data: { darkMode: boolean }) => {
            const currentTheme = useStore.getState().theme
            const bgMode = useStore.getState().backgroundMode
            // Only auto-sync if using acrylic background mode (translucent)
            if (bgMode === 'acrylic') {
              const target = data.darkMode ? 'dark' : 'light'
              if (currentTheme !== target) {
                useStore.getState().toggleTheme()
              }
            }
          })
          cleanupFns.push(cleanup)
        }

        // File watcher �?reload note data when external edits detected
        if (ei.onNoteFileChanged) {
          const cleanup = ei.onNoteFileChanged((data: { noteId: string }) => {
            if (ei.fileStore?.readNote) {
              ei.fileStore.readNote(data.noteId).then((noteData: Record<string, unknown> | null) => {
                if (noteData) {
                  useStore.getState().updateFloatingNote(data.noteId, {
                    content: String(noteData.content ?? ''),
                    title: String(noteData.title ?? ''),
                    updatedAt: Date.now(),
                  })
                }
              }).catch((err: unknown) => {
                console.error('[sync] readNote failed:', err)
              })
            }
          })
          cleanupFns.push(cleanup)
        }

        // Tray actions (open-note from tray recent notes)
        if (ei.onTrayAction) {
          ei.onTrayAction((action: { type: string; noteId?: string }) => {
            if (action.type === 'open-note' && action.noteId) {
              useStore.getState().focusNote(action.noteId)
            }
          })
        }

        // Init complete
        if (!cancelled) useStore.setState({ bootPhase: 'ready' })

        // Background: pre-warm today's astrology guidance cache
        if (!cancelled) {
          ;(async () => {
            try {
              const state = useStore.getState()
              if (state.userProfile?.birthDate) {
                const { calculateBazi, getDailyGuidance } = await import('./utils/astrology')
                const bazi = calculateBazi(new Date(state.userProfile.birthDate), state.userProfile.birthHour ?? null, state.userProfile.gender ?? null)
                if (bazi) {
                  const today = new Date()
                  const guidance = getDailyGuidance(today, bazi, state.todos)
                  if (guidance.huangli && guidance.advice) {
                    // If AI is enabled, pre-warm the AI guidance cache
                    const cfg = useStore.getState().aiConfig
                    if (cfg.enabled) {
                      const { getAIGuidance } = await import('./utils/astrology/ai-guidance')
                      getAIGuidance(today, guidance.huangli, bazi, state.todos.filter(t => !t.done), undefined, cfg).catch((err: unknown) => {
                        console.error('[astro] AI guidance pre-warm failed:', err)
                      })
                    }
                  }
                }
              }
            } catch { /* background cache warm �?fail silently */ }
          })()
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[MainApp] init failed:', e)
          useStore.setState({ bootPhase: 'failed', bootError: msg })
        }
      }
    })()

    return () => {
      cancelled = true
      if (cleanupReminder) cleanupReminder()
      cleanupFns.forEach(fn => fn())
    }
  }, [])

  // Sync recent notes to main process for tray menu (Electron only)
  useEffect(() => {
    if (!isElectron) return
    const update = () => {
      const notes = useStore.getState().floatingNotes
        .filter(n => !n.archived)
        .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
        .slice(0, 8)
        .map(n => ({ id: n.id, title: n.title }))
      ei?.updateRecentNotes?.(notes)
    }
    update()
    const unsub = useStore.subscribe(update)
    return unsub
  }, [])

  // Auto backup (Feature 2)
  useEffect(() => {
    return scheduleAutoBackup(
      () => useStore.getState(),
      (meta) => setLastBackupTime(meta.timestamp)
    )
  }, [setLastBackupTime])

  // Plugin lifecycle hooks �?subscribe to note create/save/delete
  useEffect(() => {
    let prevNotes = useStore.getState().floatingNotes
    const unsub = useStore.subscribe((state) => {
      const currNotes = state.floatingNotes
      // Detect additions
      for (const note of currNotes) {
        if (!prevNotes.find(n => n.id === note.id)) {
          pluginManager.runHook('onNoteCreated', note)
        }
      }
      // Detect deletions
      for (const note of prevNotes) {
        if (!currNotes.find(n => n.id === note.id)) {
          pluginManager.runHook('onNoteDeleted', note)
        }
      }
      // Detect saves (content/todos changes)
      for (const curr of currNotes) {
        const prev = prevNotes.find(n => n.id === curr.id)
        if (prev && (prev.content !== curr.content || JSON.stringify(prev.todos) !== JSON.stringify(curr.todos))) {
          pluginManager.runHook('onNoteSaved', curr)
          // Auto-version: create snapshot if 2+ min since last snapshot
          addAutoSnapshot(curr.id, curr.title, curr.content || '', curr.todos)
        }
      }
      prevNotes = currNotes
    })
    return unsub
  }, [])

  // Browser mode shortcuts (Electron handles its own via main.cjs)
  const openQuickTodo = useCallback(() => setQuickTodoOpen(true), [])
  const openQuickCapture = useCallback(() => setQuickCaptureOpen(true), [])
  useEffect(() => {
    if (isElectron) return
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 't') {
        e.preventDefault()
        openQuickTodo()
      } else if (e.altKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        openQuickCapture()
      } else if ((e.altKey && e.key === 'n') || (e.altKey && e.shiftKey && e.key === 'H')) {
        e.preventDefault()
        const msg = document.createElement('div')
        msg.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[99999] border border-white/[0.08] rounded-xl px-4 py-2 shadow-2xl text-xs text-white/72 backdrop-blur-xl'
        msg.style.background = 'var(--panel-bg-solid)'
        msg.textContent = t('electron.shortcutHint')
        document.body.appendChild(msg)
        setTimeout(() => msg.remove(), 3000)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [openQuickTodo, openQuickCapture])

  // Auto-scan reference links count
  useEffect(() => {
    const scanRefs = () => {
      const allNotes = useStore.getState().floatingNotes
      const refCounts = new Map<string, number>()
      for (const n of allNotes) {
        const content = n.content || ''
        const todoTexts = (n.todos || []).map(t => t.text).join(' ')
        const combined = content + ' ' + todoTexts
        const refRegex = new RegExp(PROTOCOL_LINK_REGEX.source, 'g')
        let m
        while ((m = refRegex.exec(combined)) !== null) {
          refCounts.set(m[1], (refCounts.get(m[1]) || 0) + 1)
        }
        // Scan [[Title]] wiki links
        const wikiRegex = new RegExp(WIKI_LINK_REGEX.source, 'g')
        while ((m = wikiRegex.exec(combined)) !== null) {
          const linkTitle = m[1].trim()
          const target = allNotes.find(
            n => n.title === linkTitle || n.title.toLowerCase() === linkTitle.toLowerCase()
          )
          if (target && target.id !== n.id) {
            refCounts.set(target.id, (refCounts.get(target.id) || 0) + 1)
          }
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

  // Cross-window sync for floated notes
  useEffect(() => {
    if (!ei?.onNoteSynced) return
    const syncedRecently = new Set<string>()
    const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()
    return ei.onNoteSynced((data: { id: string }) => {
      if (syncedRecently.has(data.id)) return
      syncedRecently.add(data.id)
      syncTimers.set(data.id, setTimeout(() => {
        syncedRecently.delete(data.id)
        syncTimers.delete(data.id)
      }, 2000))

      ei?.fileStore?.readNote(data.id).then((noteData: Record<string, unknown> | null) => {
        if (noteData) {
          useStore.getState().updateFloatingNote(data.id, noteData)
        }
      }).catch((e: unknown) => console.error('[App] note sync error:', e))
    })
  }, [])

  // Auto-lock on visibility change (browser tab switch / Electron minimize)
  useEffect(() => {
    if (!appPin) return
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        lockApp()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [appPin, lockApp])

  // Capture PWA install prompt
  useEffect(() => {
    if (isElectron) return
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Undo/Redo + Quick search keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          undoManager.redo()
        } else {
          undoManager.undo()
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setQuickSearchOpen(true)
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        if (appPin) {
          lockApp()
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [appPin, lockApp])

  const rootBg = backgroundMode === 'pure-white' ? '#ffffff'
    : backgroundMode === 'pure-black' ? '#000000'
    : isElectron ? 'transparent'
    : '#0c0c10'

  // Boot state machine: show loading/error before main UI
  if (bootPhase === 'booting') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center select-none"
        style={{ background: '#0c0c10' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border-2 border-fluent-blue/30 border-t-fluent-blue rounded-full animate-spin" />
          <span className="text-xs text-white/48">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  if (bootPhase === 'failed') {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center select-none gap-3 px-6"
        style={{ background: '#0c0c10' }}
      >
        <i className="fa-solid fa-circle-exclamation text-lg text-red-400/60" />
        <span className="text-xs text-white/60 text-center max-w-[280px] leading-relaxed">
          {bootError || t('common.error')}
        </span>
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-1.5 rounded-lg text-xs transition-all"
          style={{ background: '#60a5fa', color: '#fff' }}
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full overflow-hidden pwa-safe-top" style={{ background: rootBg }}>
      {/* Desktop gradient �?hidden in solid modes */}
      {backgroundMode === 'acrylic' && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-gradient-to-br from-fluent-blue/[0.02] to-transparent rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[40%] h-[30%] bg-gradient-to-tr from-fluent-purple/[0.02] to-transparent rounded-full blur-[100px]" />
        </div>
      )}

      {/* Floating notes layer �?hidden in Electron (notes use OS windows) */}
      {!isElectron && <NotesLayer />}

      {/* Main acrylic sidebar panel */}
      <AcrylicPanel />

      {/* Undo/Redo toast */}
      <UndoToast />

      {/* Error notifications */}
      <ErrorToast />

      {/* Auto-update notifier (Electron only) */}
      <UpdateNotifier />

      {/* XiaoWen pet preview — first-pass sprite/state-machine route */}
      <XiaoWenPetAvatar />

      {/* Global quick search */}
      <Suspense fallback={null}>
        <QuickSearchModal isOpen={quickSearchOpen} onClose={() => setQuickSearchOpen(false)} />
      </Suspense>

      {/* Quick todo input (Alt+T) */}
      <Suspense fallback={null}>
        <QuickTodoInput isOpen={quickTodoOpen} onClose={() => setQuickTodoOpen(false)} />
      </Suspense>

      {/* Quick capture (Alt+Shift+C) */}
      <Suspense fallback={null}>
        <QuickCapture isOpen={quickCaptureOpen} onClose={() => setQuickCaptureOpen(false)} />
      </Suspense>

      {/* Lock screen */}
      {appLocked && <LockScreen />}

      {/* PWA install prompt banner */}
      {!isElectron && <InstallPrompt prompt={installPrompt} onClose={() => setInstallPrompt(null)} />}
    </div>
  )
}

const App: React.FC = () => {
  if (isElectron && hash.startsWith('#note=')) {
    return (
      <ErrorBoundary label="StandaloneNote">
        <StandaloneNote />
      </ErrorBoundary>
    )
  }
  return (
    <ErrorBoundary label="MainApp">
      <MainApp />
    </ErrorBoundary>
  )
}

export default App
