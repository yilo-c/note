const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'

let win = null
let tray = null
const noteWindows = new Map()

// Tray preferences persistence
const trayPrefsPath = path.join(app.getPath('userData'), 'tray-prefs.json')

function loadTrayPrefs() {
  try {
    if (fs.existsSync(trayPrefsPath)) {
      return JSON.parse(fs.readFileSync(trayPrefsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return { autoLaunch: false }
}

function saveTrayPrefs(prefs) {
  try {
    const dir = path.dirname(trayPrefsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(trayPrefsPath, JSON.stringify(prefs, null, 2))
  } catch { /* ignore */ }
}

app.commandLine.appendSwitch('enable-transparent-visuals')

function createTray() {
  // Create a small 16x16 tray icon programmatically
  const iconSize = 16
  const canvas = nativeImage.createFromBuffer(
    Buffer.alloc(iconSize * iconSize * 4),
    { width: iconSize, height: iconSize }
  )
  // Alternative: try to load from assets if exists
  let trayIcon = canvas
  const iconPath = path.join(__dirname, '..', 'public', 'tray-icon.png')
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  }

  tray = new Tray(trayIcon)
  tray.setToolTip('思忆便签')

  updateTrayMenu()

  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide()
      } else {
        win.show()
        win.focus()
      }
    }
  })
}

function updateTrayMenu() {
  const prefs = loadTrayPrefs()
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (win) { win.show(); win.focus() }
      },
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: prefs.autoLaunch,
      click: (menuItem) => {
        const enabled = menuItem.checked
        app.setLoginItemSettings({ openAtLogin: enabled })
        saveTrayPrefs({ ...prefs, autoLaunch: enabled })
        // Notify renderer
        if (win && !win.isDestroyed()) {
          win.webContents.send('tray-action', { type: 'auto-launch-changed', enabled })
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)
}

function createMainWindow() {
  win = new BrowserWindow({
    width: 380,
    height: 680,
    x: 100,
    y: 60,
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5175')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Close → hide to tray (Feature 3)
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      win.hide()
      return
    }
    // Really quitting: close child windows
    for (const [, child] of noteWindows) {
      if (!child.isDestroyed()) child.close()
    }
    noteWindows.clear()
  })

  // --- Global Shortcuts (Feature 6) ---
  globalShortcut.register('Alt+N', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('global-shortcut', { action: 'new-note' })
    }
  })

  globalShortcut.register('Alt+T', () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('global-shortcut', { action: 'new-todo' })
    }
  })

  globalShortcut.register('Alt+Shift+H', () => {
    if (win && !win.isDestroyed()) {
      if (win.isVisible()) {
        win.hide()
      } else {
        win.show()
        win.focus()
      }
    }
  })

  globalShortcut.register('Escape', () => {
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide()
    }
  })

  globalShortcut.register('F5', () => {
    if (win && !win.isDestroyed()) win.reload()
  })
}

function createNoteWindow(data) {
  if (noteWindows.has(data.id)) {
    const existing = noteWindows.get(data.id)
    if (!existing.isDestroyed()) {
      existing.focus()
      return
    }
    noteWindows.delete(data.id)
  }

  const mainBounds = win ? win.getBounds() : { x: 0, y: 0 }
  const screenX = mainBounds.x + (data.screenX || 100)
  const screenY = mainBounds.y + (data.screenY || 100)

  const child = new BrowserWindow({
    width: data.width || 260,
    height: data.height || 200,
    x: Math.max(0, screenX),
    y: Math.max(0, screenY),
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const hash = `#note=${data.id}`

  if (isDev) {
    child.loadURL(`http://localhost:5175/${hash}`)
  } else {
    child.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash })
  }

  noteWindows.set(data.id, child)
  child.on('closed', () => {
    noteWindows.delete(data.id)
    // Notify main renderer that the note has returned to NotesLayer
    if (win && !win.isDestroyed()) {
      win.webContents.send('note-returned', { id: data.id })
    }
  })
}

function closeNoteWindow(noteId) {
  const child = noteWindows.get(noteId)
  if (child && !child.isDestroyed()) {
    child.close()
  }
  noteWindows.delete(noteId)
}

// --- IPC Handlers ---

// Window controls
ipcMain.on('window-minimize', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) w.minimize()
})

ipcMain.on('window-close', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) {
    // For floating note windows, close directly
    w.close()
  }
})

// Floating note windows
ipcMain.on('create-note-window', (event, data) => {
  createNoteWindow(data)
})

ipcMain.on('close-note-window', (event, noteId) => {
  closeNoteWindow(noteId)
})

// Fullscreen toggle
ipcMain.on('window-fullscreen', (event) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) {
    w.setFullScreen(!w.isFullScreen())
  }
})

// Window always-on-top (for pinning)
ipcMain.on('window-always-on-top', (event, { on }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) {
    w.setAlwaysOnTop(on)
  }
})

// Window ignore mouse events (for locking in concert with CSS pointer-events)
ipcMain.on('window-ignore-mouse', (event, { ignore }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) {
    w.setIgnoreMouseEvents(ignore, { forward: !ignore })
  }
})

// Window resize
ipcMain.on('window-resize', (event, { width, height }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) {
    const b = w.getBounds()
    w.setBounds({ x: b.x, y: b.y, width: Math.max(280, width), height: Math.max(400, height) })
  }
})

// Window set-resizable (lock reinforcement for standalone windows)
ipcMain.on('window-set-resizable', (event, { resizable }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w && !w.isDestroyed()) {
    w.setResizable(resizable)
  }
})

// Save dialog for export (Feature 1)
ipcMain.on('show-save-dialog', async (event, { filename, content, mimeType }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (!w) return

  const result = await dialog.showSaveDialog(w, {
    defaultPath: filename,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (!result.canceled && result.filePath) {
    try {
      // Write the content to the selected file path
      const ext = path.extname(result.filePath).toLowerCase()
      if (ext === '.json') {
        fs.writeFileSync(result.filePath, content, 'utf-8')
      } else {
        fs.writeFileSync(result.filePath, content, 'utf-8')
      }
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }
})

// Auto launch (Feature 3)
ipcMain.on('set-auto-launch', (event, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable })
  const prefs = loadTrayPrefs()
  saveTrayPrefs({ ...prefs, autoLaunch: enable })
  // Update tray menu to reflect new state
  if (tray) updateTrayMenu()
})

ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin
})

// --- App lifecycle ---

app.whenReady().then(() => {
  createMainWindow()
  createTray()
})

app.on('window-all-closed', () => {
  // Don't quit on window close; tray keeps running
})

app.on('before-quit', () => {
  app.isQuitting = true
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  if (win) { win.show(); win.focus() }
})
