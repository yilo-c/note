/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => void
  close: () => void
  createFloatingWindow: (data: Record<string, unknown>) => void
  deleteFloatingWindow: (noteId: string) => void
  hideFloatingWindows: () => void
  showFloatingWindows: () => void
  resizeWindow: (w: number, h: number) => void
  fullscreen: () => void
  alwaysOnTop: (on: boolean) => void
  ignoreMouseEvents: (opts: { ignore: boolean }) => void
  showSaveDialog: (data: { filename: string; content: string; mimeType?: string }) => void
  setAutoLaunch: (enable: boolean) => void
  getAutoLaunch: () => Promise<boolean>
  onTrayAction: (callback: (action: { type: string; noteId?: string }) => void) => void
  onGlobalShortcut: (callback: (data: { action: string; content?: string }) => void) => () => void
  onNoteReturned: (callback: (data: { id: string }) => void) => () => void
  onNoteSynced: (callback: (data: { id: string }) => void) => () => void
  setResizable: (resizable: boolean) => void
  fileStore: {
    init: () => Promise<{ migrated: boolean }>
    readFile: (relativePath: string) => Promise<string | null>
    writeFile: (relativePath: string, content: string) => Promise<void>
    deleteFile: (relativePath: string) => Promise<void>
    readNote: (noteId: string) => Promise<Record<string, unknown> | null>
    writeNote: (noteId: string, noteData: Record<string, unknown>) => Promise<void>
    listNotes: () => Promise<string[]>
    noteExists: (noteId: string) => Promise<boolean>
  }
  updateReminders: (todos: Array<Record<string, unknown>>) => Promise<void>
  sendBackgroundMode: (mode: string) => void
  updateRecentNotes: (notes: Record<string, unknown>[]) => void
  onNativeThemeChanged: (callback: (data: { darkMode: boolean }) => void) => () => void
  onNoteFileChanged: (callback: (data: { noteId: string }) => void) => () => void
  imageStore: {
    save: (data: { dataUrl: string; name?: string }) => Promise<{ path: string | null }>
    read: (filename: string) => Promise<string | null>
    delete: (filename: string) => Promise<boolean>
    list: () => Promise<string[]>
  }
  readUsageDoc: () => Promise<string | null>

  update: {
    check: () => Promise<void>
    download: () => Promise<void>
    install: () => Promise<void>
    onChecking: (callback: () => void) => () => void
    onAvailable: (callback: (info: Record<string, unknown>) => void) => () => void
    onNotAvailable: (callback: () => void) => () => void
    onError: (callback: (msg: string) => void) => () => void
    onProgress: (callback: (progress: Record<string, unknown>) => void) => () => void
    onDownloaded: (callback: (info: Record<string, unknown>) => void) => () => void
  }
}

interface Window {
  electronAPI?: ElectronAPI
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}
