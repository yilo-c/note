const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),

  // Floating windows
  createFloatingWindow: (data) => ipcRenderer.send('create-note-window', data),
  deleteFloatingWindow: (noteId) => ipcRenderer.send('close-note-window', noteId),
  hideFloatingWindows: () => ipcRenderer.send('floating-windows:hide'),
  showFloatingWindows: () => ipcRenderer.send('floating-windows:show'),

  // Resize
  resizeWindow: (w, h) => ipcRenderer.send('window-resize', { width: w, height: h }),

  // Fullscreen toggle
  fullscreen: () => ipcRenderer.send('window-fullscreen'),

  // Pin / always-on-top
  alwaysOnTop: (on) => ipcRenderer.send('window-always-on-top', { on }),

  // Ignore mouse events (lock reinforcement)
  ignoreMouseEvents: (opts) => ipcRenderer.send('window-ignore-mouse', opts),

  // Save dialog for export
  showSaveDialog: (data) => ipcRenderer.send('show-save-dialog', data),

  // Auto launch (Feature 3)
  setAutoLaunch: (enable) => ipcRenderer.send('set-auto-launch', enable),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),

  // Tray actions (Feature 3)
  onTrayAction: (callback) => {
    ipcRenderer.on('tray-action', (_event, action) => callback(action))
  },

  // Global shortcuts (Feature 6)
  onGlobalShortcut: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('global-shortcut', handler)
    return () => ipcRenderer.removeListener('global-shortcut', handler)
  },

  // Note returned from OS window to NotesLayer (Feature 4)
  onNoteReturned: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('note-returned', handler)
    return () => ipcRenderer.removeListener('note-returned', handler)
  },

  // Cross-window sync for floated notes
  onNoteSynced: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('note-synced', handler)
    return () => ipcRenderer.removeListener('note-synced', handler)
  },

  // Lock: disable/enable window resizing (Electron standalone)
  setResizable: (resizable) => ipcRenderer.send('window-set-resizable', { resizable }),

  // File Store — persistent file-based storage
  fileStore: {
    init: () => ipcRenderer.invoke('file-store:init'),
    readFile: (relativePath) => ipcRenderer.invoke('file-store:read-file', relativePath),
    writeFile: (relativePath, content) => ipcRenderer.invoke('file-store:write-file', relativePath, content),
    deleteFile: (relativePath) => ipcRenderer.invoke('file-store:delete-file', relativePath),
    readNote: (noteId) => ipcRenderer.invoke('file-store:read-note', noteId),
    writeNote: (noteId, noteData) => ipcRenderer.invoke('file-store:write-note', noteId, noteData),
    listNotes: () => ipcRenderer.invoke('file-store:list-notes'),
    noteExists: (noteId) => ipcRenderer.invoke('file-store:note-exists', noteId),
  },

  // Reminders — sync todos to main process for due-date notifications
  updateReminders: (todos) => ipcRenderer.invoke('reminder:update', todos),

  // Background mode — sync to main process so floating windows inherit it
  sendBackgroundMode: (mode) => ipcRenderer.send('background-mode:set', mode),

  // Recent notes update (for tray menu)
  updateRecentNotes: (notes) => ipcRenderer.send('recent-notes:update', notes),

  // Native theme sync
  onNativeThemeChanged: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('native-theme-changed', handler)
    return () => ipcRenderer.removeListener('native-theme-changed', handler)
  },

  // File watcher — external note file changes
  onNoteFileChanged: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('note-file-changed', handler)
    return () => ipcRenderer.removeListener('note-file-changed', handler)
  },

  // Image store — save/read/delete embedded images
  imageStore: {
    save: (data) => ipcRenderer.invoke('image:save', data),
    read: (filename) => ipcRenderer.invoke('image:read', filename),
    delete: (filename) => ipcRenderer.invoke('image:delete', filename),
    list: () => ipcRenderer.invoke('image:list'),
  },

  // Usage document
  readUsageDoc: () => ipcRenderer.invoke('usage:read'),

  // Auto-update (Feature 7)
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('update:checking', handler)
      return () => ipcRenderer.removeListener('update:checking', handler)
    },
    onAvailable: (callback) => {
      const handler = (_event, info) => callback(info)
      ipcRenderer.on('update:available', handler)
      return () => ipcRenderer.removeListener('update:available', handler)
    },
    onNotAvailable: (callback) => {
      const handler = () => callback()
      ipcRenderer.on('update:not-available', handler)
      return () => ipcRenderer.removeListener('update:not-available', handler)
    },
    onError: (callback) => {
      const handler = (_event, msg) => callback(msg)
      ipcRenderer.on('update:error', handler)
      return () => ipcRenderer.removeListener('update:error', handler)
    },
    onProgress: (callback) => {
      const handler = (_event, progress) => callback(progress)
      ipcRenderer.on('update:progress', handler)
      return () => ipcRenderer.removeListener('update:progress', handler)
    },
    onDownloaded: (callback) => {
      const handler = (_event, info) => callback(info)
      ipcRenderer.on('update:downloaded', handler)
      return () => ipcRenderer.removeListener('update:downloaded', handler)
    },
  },
})
