const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),

  // Floating windows
  createFloatingWindow: (data) => ipcRenderer.send('create-note-window', data),
  deleteFloatingWindow: (noteId) => ipcRenderer.send('close-note-window', noteId),

  // Resize
  resizeWindow: (w, h) => ipcRenderer.send('window-resize', { width: w, height: h }),

  // Fullscreen toggle
  fullscreen: () => ipcRenderer.send('window-fullscreen'),

  // Pin / always-on-top
  alwaysOnTop: (on) => ipcRenderer.send('window-always-on-top', { on }),

  // Ignore mouse events (lock reinforcement)
  ignoreMouseEvents: (ignore) => ipcRenderer.send('window-ignore-mouse', { ignore }),

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
    ipcRenderer.on('global-shortcut', (_event, data) => callback(data))
  },

  // Note returned from OS window to NotesLayer (Feature 4)
  onNoteReturned: (callback) => {
    ipcRenderer.on('note-returned', (_event, data) => callback(data))
  },

  // Lock: disable/enable window resizing (Electron standalone)
  setResizable: (resizable) => ipcRenderer.send('window-set-resizable', { resizable }),
})
