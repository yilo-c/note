const { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, dialog, Notification, screen, nativeTheme, clipboard, protocol, net } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { pathToFileURL } = require('url')
const { autoUpdater } = require('electron-updater')

// ── Global error handlers ────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[main] Uncaught exception:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[main] Unhandled rejection:', err)
})

// ── File Store ──────────────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('userData'), 'siyi-notes')
const NOTES_DIR = path.join(DATA_DIR, 'notes')

function ensureDataDirs() {
  fs.mkdirSync(NOTES_DIR, { recursive: true })
}

/** Guard against path traversal — ensures resolved path stays within allowed dir */
function guardPath(allowedDir, userPath) {
  const resolved = path.resolve(allowedDir, userPath)
  if (!resolved.startsWith(path.resolve(allowedDir))) {
    throw new Error(`Path traversal denied: ${userPath}`)
  }
  return resolved
}

/** Validate noteId to prevent path injection */
function isValidNoteId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && !/[\\/]/.test(id) && !id.includes('..')
}

/**
 * Parse YAML frontmatter + body from a .md file string.
 * Returns { frontmatter: {}, body: '' }
 */
function parseNoteFile(raw) {
  const result = { frontmatter: {}, body: raw || '' }
  if (!raw) return result
  const trimmed = raw.trimStart()
  if (!trimmed.startsWith('---')) return result
  const end = trimmed.indexOf('---', 3)
  if (end === -1) return result
  const fmRaw = trimmed.slice(3, end).trim()
  result.body = trimmed.slice(end + 3).trimStart()
  for (const line of fmRaw.split('\n')) {
    const colIdx = line.indexOf(':')
    if (colIdx === -1) continue
    const key = line.slice(0, colIdx).trim()
    let val = line.slice(colIdx + 1).trim()
    // Remove surrounding quotes
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.slice(1, -1)
    }

    // Try JSON.parse for complex values (arrays of objects, etc.)
    // Must come before simple array parsing since JSON arrays start with '['
    if (val && (val[0] === '[' || val[0] === '{')) {
      try {
        result.frontmatter[key] = JSON.parse(val)
        continue
      } catch {
        // Fall through to simple parsing
      }
    }

    // Parse simple arrays: [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1, -1).trim()
      result.frontmatter[key] = inner ? inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')) : []
    } else if (val === 'true') {
      result.frontmatter[key] = true
    } else if (val === 'false') {
      result.frontmatter[key] = false
    } else if (/^\d+$/.test(val)) {
      result.frontmatter[key] = parseInt(val, 10)
    } else if (/^\d+\.\d+$/.test(val)) {
      result.frontmatter[key] = parseFloat(val)
    } else {
      result.frontmatter[key] = val
    }
  }
  return result
}

/**
 * Serialize a note object into .md with YAML frontmatter.
 */
function serializeNoteFile(note) {
  const { content, ...meta } = note
  const lines = ['---']
  for (const [key, val] of Object.entries(meta)) {
    if (val === undefined || val === null) continue
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'object') {
        // Arrays of objects (e.g. todos): JSON encode as a YAML-quoted string
        lines.push(`${key}: '${JSON.stringify(val)}'`)
      } else {
        lines.push(`${key}: [${val.map(v => typeof v === 'string' ? `"${v}"` : v).join(', ')}]`)
      }
    } else if (typeof val === 'object' && val !== null) {
      // Other objects: JSON encode
      lines.push(`${key}: '${JSON.stringify(val)}'`)
    } else if (typeof val === 'string') {
      // Quote strings with spaces or special chars
      if (val.includes(':') || val.includes('#') || val.includes("'")) {
        lines.push(`${key}: "${val}"`)
      } else {
        lines.push(`${key}: ${val}`)
      }
    } else {
      lines.push(`${key}: ${val}`)
    }
  }
  lines.push('---', '')
  lines.push(content || '')
  return lines.join('\n')
}

/**
 * Read localStorage from the main renderer (used during migration).
 */
async function readRendererLocalStorage(win, key) {
  try {
    return await win.webContents.executeJavaScript(
      `(() => { try { return localStorage.getItem('${key}') } catch { return null } })()`,
      true
    )
  } catch {
    return null
  }
}

/**
 * Clear localStorage key in the renderer.
 */
async function clearRendererLocalStorage(win, key) {
  try {
    await win.webContents.executeJavaScript(
      `(() => { try { localStorage.removeItem('${key}') } catch {} })()`,
      true
    )
  } catch { /* ignore */ }
}

// ── End File Store ──────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV === 'development'

// ── Auto Updater ────────────────────────────────────────────────────────────
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('checking-for-update', () => {
  if (win && !win.isDestroyed()) win.webContents.send('update:checking')
})

autoUpdater.on('update-available', (info) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  }
})

autoUpdater.on('update-not-available', () => {
  if (win && !win.isDestroyed()) win.webContents.send('update:not-available')
})

autoUpdater.on('error', (err) => {
  if (win && !win.isDestroyed()) win.webContents.send('update:error', err.message || 'Unknown error')
})

autoUpdater.on('download-progress', (progress) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  }
})

autoUpdater.on('update-downloaded', (info) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('update:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
    })
  }
})

/** Trigger update check (called from renderer) */
ipcMain.handle('update:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return { success: true, result }
  } catch (err) {
    const msg = (err && typeof err === 'object' && err.message) ? err.message : String(err)
    return { success: false, error: msg }
  }
})

/** Start downloading the update (called from renderer after user approves) */
ipcMain.handle('update:download', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (err) {
    const msg = (err && typeof err === 'object' && err.message) ? err.message : String(err)
    return { success: false, error: msg }
  }
})

/** Install the update and restart (called from renderer) */
ipcMain.handle('update:install', async () => {
  setImmediate(() => autoUpdater.quitAndInstall())
  return { success: true }
})
// ── End Auto Updater ────────────────────────────────────────────────────────

let win = null
let tray = null
let currentBackgroundMode = 'acrylic' // synced from renderer for floating windows
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

// Window position persistence
const windowsPrefsPath = path.join(app.getPath('userData'), 'windows.json')

function loadWindowPrefs() {
  try {
    if (fs.existsSync(windowsPrefsPath)) {
      return JSON.parse(fs.readFileSync(windowsPrefsPath, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

function saveWindowPrefs(prefs) {
  try {
    const dir = path.dirname(windowsPrefsPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(windowsPrefsPath, JSON.stringify(prefs, null, 2))
  } catch { /* ignore */ }
}

// Recent notes for tray quick access (max 8)
let recentNotes = []

function updateRecentNotes(notes) {
  recentNotes = notes.slice(0, 8).map(n => ({
    id: String(n.id || ''),
    title: typeof n.title === 'string' ? n.title : '',
  }))
  if (tray) updateTrayMenu()
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
  const iconPath = path.join(__dirname, '..', 'public', 'icon-16.png')
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
  const template = [
    {
      label: '显示主窗口',
      click: () => {
        if (win) { win.show(); win.focus() }
      },
    },
    { type: 'separator' },
  ]

  // Recent notes
  if (recentNotes.length > 0) {
    for (const note of recentNotes) {
      template.push({
        label: note.title || '(无标题)',
        click: () => {
          if (win && !win.isDestroyed()) {
            win.show()
            win.focus()
            win.webContents.send('tray-action', { type: 'open-note', noteId: note.id })
          }
        },
      })
    }
    template.push({ type: 'separator' })
  }

  template.push(
    {
      label: '新建便签',
      accelerator: 'Alt+N',
      click: () => {
        if (win && !win.isDestroyed()) {
          win.show()
          win.focus()
          win.webContents.send('global-shortcut', { action: 'new-note' })
        }
      },
    },
    {
      label: '新建待办',
      accelerator: 'Alt+T',
      click: () => {
        if (win && !win.isDestroyed()) {
          win.show()
          win.focus()
          win.webContents.send('global-shortcut', { action: 'new-todo' })
        }
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
  )

  try {
    tray.setContextMenu(Menu.buildFromTemplate(template))
  } catch (err) {
    console.error('[tray] Failed to build tray menu:', err)
  }
}

function createMainWindow() {
  const savedBounds = loadWindowPrefs().mainWindow || {}
  const defaultW = 450
  const defaultH = 720
  const winOpts = {
    width: savedBounds.width || defaultW,
    height: savedBounds.height || defaultH,
    frame: false,
    transparent: true,
    resizable: true,
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }

  // Only set x/y if previously saved (avoid spawning off-screen)
  if (savedBounds.x !== undefined && savedBounds.y !== undefined) {
    // Clamp to available displays
    const displays = screen.getAllDisplays()
    const bounds = displays.reduce((acc, d) => ({
      x: Math.min(acc.x, d.bounds.x),
      y: Math.min(acc.y, d.bounds.y),
      width: Math.max(acc.width, d.bounds.x + d.bounds.width),
      height: Math.max(acc.height, d.bounds.y + d.bounds.height),
    }), { x: 0, y: 0, width: 0, height: 0 })
    const rightEdge = bounds.x + bounds.width
    const bottomEdge = bounds.y + bounds.height
    winOpts.x = Math.max(bounds.x, Math.min(savedBounds.x, rightEdge - 100))
    winOpts.y = Math.max(bounds.y, Math.min(savedBounds.y, bottomEdge - 100))
  }

  win = new BrowserWindow(winOpts)

  if (isDev) {
    // Try multiple dev server ports, fall back to dist
    ;(async () => {
      for (const port of [5175, 5176, 5177, 5178]) {
        try {
          const resp = await fetch(`http://localhost:${port}`)
          if (resp.ok) {
            win.loadURL(`http://localhost:${port}`)
            win.webContents.openDevTools({ mode: 'detach' })
            return
          }
        } catch {}
      }
      win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    })()
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
    globalShortcut.unregisterAll()
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

  globalShortcut.register('Alt+Space', () => {
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
      win.webContents.send('global-shortcut', { action: 'quick-search' })
    }
  })

  // Quick capture modal: Alt+Shift+C
  globalShortcut.register('Alt+Shift+C', () => {
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
      win.webContents.send('global-shortcut', { action: 'quick-capture' })
    }
  })

  // Clipboard quick-capture: Alt+Shift+V → create note from clipboard
  globalShortcut.register('Alt+Shift+V', () => {
    if (win && !win.isDestroyed()) {
      const text = clipboard.readText()
      if (text && text.trim()) {
        win.show()
        win.focus()
        win.webContents.send('global-shortcut', { action: 'new-note', content: text.trim() })
      }
    }
  })

  // ── Window position persistence ──
  let saveTimer = null
  const saveBounds = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!win || win.isDestroyed()) return
      const bounds = win.getBounds()
      const prefs = loadWindowPrefs()
      const toSave = { x: bounds.x, y: bounds.y }
      if (bounds.width !== defaultW || bounds.height !== defaultH) {
        toSave.width = bounds.width
        toSave.height = bounds.height
      }
      prefs.mainWindow = toSave
      saveWindowPrefs(prefs)
    }, 500)
  }
  win.on('resize', saveBounds)
  win.on('move', saveBounds)

  // ── Native theme sync ──
  const syncTheme = () => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('native-theme-changed', {
        darkMode: nativeTheme.shouldUseDarkColors,
      })
    }
  }
  nativeTheme.on('updated', syncTheme)
  // Send initial theme on load
  win.webContents.on('did-finish-load', syncTheme)
}

function createNoteWindow(data) {
  if (!isValidNoteId(data.id)) {
    console.error('[main] Invalid noteId for floating window:', data.id)
    return
  }

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

  // Write .md file immediately so the standalone window can load it
  if (data.noteData) {
    try {
      ensureDataDirs()
      const mdPath = path.join(NOTES_DIR, `${data.id}.md`)
      fs.writeFileSync(mdPath, serializeNoteFile(data.noteData), 'utf-8')
    } catch (err) {
      console.error('[main] Failed to write note file before floating window:', err)
    }
  }

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

  const bgMode = data.backgroundMode || currentBackgroundMode || 'acrylic'
  const hash = `#note=${data.id}&bg=${bgMode}`

  if (isDev) {
    // Try multiple dev server ports, fall back to dist
    ;(async () => {
      for (const port of [5175, 5176, 5177, 5178]) {
        try {
          const resp = await fetch(`http://localhost:${port}`)
          if (resp.ok) {
            child.loadURL(`http://localhost:${port}/${hash}`)
            child.webContents.openDevTools({ mode: 'detach' })
            return
          }
        } catch {}
      }
      child.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash })
    })()
  } else {
    child.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash })
  }

  noteWindows.set(data.id, child)
  child.on('closed', () => {
    noteWindows.delete(data.id)
    // Ensure .md file has floated=false (wins the race vs standalone's last save)
    try {
      const mdPath = path.join(NOTES_DIR, `${data.id}.md`)
      if (fs.existsSync(mdPath)) {
        const raw = fs.readFileSync(mdPath, 'utf-8')
        const { frontmatter, body } = parseNoteFile(raw)
        if (frontmatter.floated !== false) {
          frontmatter.floated = false
          fs.writeFileSync(mdPath, serializeNoteFile({ ...frontmatter, content: body }), 'utf-8')
        }
      }
    } catch (_e) { /* best-effort */ }
    // Notify main renderer that the note has returned to NotesLayer + sync content
    if (win && !win.isDestroyed()) {
      win.webContents.send('note-returned', { id: data.id })
      win.webContents.send('note-synced', { id: data.id })
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

// ── Reminder Scheduler ──────────────────────────────────────────────────────

const NOTIFIED_FILE = path.join(DATA_DIR, '.notified.json')

let reminderTodos = []         // { id, text, done, dueDate }
let notifiedMap = {}           // { [todoId]: true }
let reminderInterval = null

function loadNotified() {
  try {
    if (fs.existsSync(NOTIFIED_FILE)) {
      notifiedMap = JSON.parse(fs.readFileSync(NOTIFIED_FILE, 'utf-8'))
    }
  } catch { /* ignore */ }
}

function saveNotified() {
  try {
    ensureDataDirs()
    fs.writeFileSync(NOTIFIED_FILE, JSON.stringify(notifiedMap), 'utf-8')
  } catch { /* ignore */ }
}

/**
 * Show a system notification for a due/overdue todo.
 */
function showReminder(item) {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: '⏰ 待办到期提醒',
    body: item.text,
  })
  notification.on('click', () => {
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
    }
  })
  notification.show()
}

/**
 * Poll todos and fire notifications for due/overdue items.
 */
function pollReminders() {
  const now = Date.now()
  let overdueCount = 0
  let changed = false

  for (const todo of reminderTodos) {
    if (todo.done || !todo.dueDate) continue

    if (todo.dueDate <= now) {
      // Overdue or due now
      overdueCount++
      const key = todo.id + ':due'
      if (!notifiedMap[key]) {
        showReminder(todo)
        notifiedMap[key] = true
        changed = true
      }
    }
  }

  if (changed) saveNotified()

  // Update badge count (Windows taskbar / macOS dock)
  if (app.isReady()) {
    app.setBadgeCount(overdueCount)
  }
}

/**
 * Start the reminder polling loop.
 */
function startReminderScheduler() {
  loadNotified()
  pollReminders()
  if (reminderInterval) clearInterval(reminderInterval)
  reminderInterval = setInterval(pollReminders, 30000)
}

function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval)
    reminderInterval = null
  }
}

// ── End Reminder Scheduler ──────────────────────────────────────────────────

// ── WiFi LAN Sync Server ────────────────────────────────────────────────────

const SYNC_PORT = 9527
let syncServer = null

function startSyncServer() {
  if (syncServer) return
  syncServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }

    if (req.url === '/api/sync') {
      try {
        const storePath = path.join(DATA_DIR, 'store.json')
        if (!fs.existsSync(storePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No data found' }))
          return
        }
        const data = fs.readFileSync(storePath, 'utf-8')
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(data)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }

    res.writeHead(404)
    res.end()
  })

  syncServer.listen(SYNC_PORT, '0.0.0.0', () => {
    console.log(`[sync] WiFi LAN sync server listening on http://0.0.0.0:${SYNC_PORT}`)
  })
}

function stopSyncServer() {
  if (syncServer) {
    syncServer.close()
    syncServer = null
  }
}

// ── End WiFi LAN Sync Server ────────────────────────────────────────────────

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
  if (!data || typeof data.id !== 'string') return
  createNoteWindow(data)
})

ipcMain.on('close-note-window', (event, noteId) => {
  if (typeof noteId !== 'string') return
  closeNoteWindow(noteId)
})

// Hide/show all floating windows (driven by panelMode switch)
ipcMain.on('floating-windows:hide', () => {
  for (const [, child] of noteWindows) {
    if (!child.isDestroyed()) child.hide()
  }
})

ipcMain.on('floating-windows:show', () => {
  for (const [, child] of noteWindows) {
    if (!child.isDestroyed() && !child.isVisible()) child.show()
  }
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

// Background mode sync — forwarded to floating windows so they render correctly
ipcMain.on('background-mode:set', (event, mode) => {
  currentBackgroundMode = mode || 'acrylic'
})

// Window ignore mouse events (for locking in concert with CSS pointer-events)
// When locked, dynamically passes click-through below the title bar (~44px)
// so the desktop beneath is interactive, while the title bar stays clickable.
const TITLE_BAR_HEIGHT = 44
ipcMain.on('window-ignore-mouse', (event, { ignore }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (!w || w.isDestroyed()) return

  // Clear any existing polling interval
  const old = w.__ignoreMouseInterval
  if (old) { clearInterval(old); w.__ignoreMouseInterval = null }

  if (!ignore) {
    // Restore normal mouse events
    // Explicit forward:false to prevent Electron forward-flag stuck bug
    w.setIgnoreMouseEvents(false, { forward: false })
    return
  }

  // Lock: immediately ignore, then poll to refine title bar vs content area
  w.setIgnoreMouseEvents(true, { forward: true })
  w.__ignoreMouseInterval = setInterval(() => {
    try {
      if (w.isDestroyed()) {
        clearInterval(w.__ignoreMouseInterval)
        w.__ignoreMouseInterval = null
        return
      }
      const cursor = screen.getCursorScreenPoint()
      const bounds = w.getBounds()
      const relY = cursor.y - bounds.y
      const inTitleBar = relY >= 0 && relY < TITLE_BAR_HEIGHT

      if (inTitleBar) {
        w.setIgnoreMouseEvents(false)
      } else {
        w.setIgnoreMouseEvents(true, { forward: true })
      }
    } catch (_) {
      // Ignore polling errors silently
    }
  }, 100)
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
ipcMain.on('show-save-dialog', (event, { filename, content }) => {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (!w) return

  dialog.showSaveDialog(w, {
    defaultPath: filename,
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  }).then(result => {
    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, typeof content === 'string' ? content : String(content), 'utf-8')
    }
  }).catch(err => {
    console.error('Failed to save file:', err)
  })
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

// Recent notes for tray
ipcMain.on('recent-notes:update', (event, notes) => {
  if (Array.isArray(notes)) updateRecentNotes(notes)
})

// ── File Store IPC handlers ──────────────────────────────────────────────────

ipcMain.handle('file-store:init', async (event) => {
  ensureDataDirs()
  const w = BrowserWindow.fromWebContents(event.sender)
  if (!w) return { migrated: false }

  // Check if data already exists on disk
  const storePath = path.join(DATA_DIR, 'store.json')
  if (fs.existsSync(storePath)) {
    return { migrated: false }
  }

  // Try to migrate from localStorage
  const raw = await readRendererLocalStorage(w, 'desk-notes-storage')
  if (!raw) return { migrated: false }

  try {
    const parsed = JSON.parse(raw)
    const { state } = parsed
    if (!state) return { migrated: false }

    // Extract floatingNotes → individual .md files
    const notes = state.floatingNotes || []
    for (const note of notes) {
      const mdPath = path.join(NOTES_DIR, `${note.id}.md`)
      fs.writeFileSync(mdPath, serializeNoteFile(note), 'utf-8')
    }

    // Write store.json (without floatingNotes — they're in .md files)
    const { floatingNotes, ...storeState } = state
    fs.writeFileSync(storePath, JSON.stringify({ ...parsed, state: storeState }), 'utf-8')

    // Migrate trash if exists
    const trashRaw = await readRendererLocalStorage(w, 'desk-notes-trash')
    if (trashRaw) {
      fs.writeFileSync(path.join(DATA_DIR, 'trash.json'), trashRaw, 'utf-8')
    }

    // Clear migrated localStorage keys
    await clearRendererLocalStorage(w, 'desk-notes-storage')
    await clearRendererLocalStorage(w, 'desk-notes-trash')

    return { migrated: true }
  } catch (err) {
    console.error('[file-store] Migration failed:', err)
    return { migrated: false }
  }
})

ipcMain.handle('file-store:read-file', async (event, relativePath) => {
  try {
    if (typeof relativePath !== 'string') return null
    const fullPath = guardPath(DATA_DIR, relativePath)
    if (!fs.existsSync(fullPath)) return null
    return fs.readFileSync(fullPath, 'utf-8')
  } catch (err) {
    console.error(`[file-store] read-file failed: ${relativePath}`, err)
    return null
  }
})

ipcMain.handle('file-store:write-file', async (event, relativePath, content) => {
  try {
    if (typeof relativePath !== 'string') throw new Error('invalid path')
    const fullPath = guardPath(DATA_DIR, relativePath)
    fs.mkdirSync(path.dirname(fullPath), { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
  } catch (err) {
    console.error(`[file-store] write-file failed: ${relativePath}`, err)
    throw err
  }
})

ipcMain.handle('file-store:delete-file', async (event, relativePath) => {
  try {
    if (typeof relativePath !== 'string') return
    const fullPath = guardPath(DATA_DIR, relativePath)
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }
  } catch (err) {
    console.error(`[file-store] delete-file failed: ${relativePath}`, err)
  }
})

ipcMain.handle('file-store:read-note', async (event, noteId) => {
  try {
    if (!isValidNoteId(noteId)) return null
    const mdPath = path.join(NOTES_DIR, `${noteId}.md`)
    if (!fs.existsSync(mdPath)) return null
    const raw = fs.readFileSync(mdPath, 'utf-8')
    const { frontmatter, body } = parseNoteFile(raw)
    return { ...frontmatter, content: body }
  } catch (err) {
    console.error(`[file-store] read-note failed: ${noteId}`, err)
    return null
  }
})

ipcMain.handle('file-store:write-note', async (event, noteId, noteData) => {
  try {
    if (!isValidNoteId(noteId)) throw new Error('invalid noteId')
    const mdPath = path.join(NOTES_DIR, `${noteId}.md`)
    fs.writeFileSync(mdPath, serializeNoteFile(noteData), 'utf-8')

    // Cross-window sync: broadcast to all other windows
    for (const w of BrowserWindow.getAllWindows()) {
      if (w !== event.sender && !w.isDestroyed()) {
        w.webContents.send('note-synced', { id: noteId })
      }
    }
  } catch (err) {
    console.error(`[file-store] write-note failed: ${noteId}`, err)
    throw err
  }
})

ipcMain.handle('file-store:list-notes', async () => {
  try {
    ensureDataDirs()
    const files = fs.readdirSync(NOTES_DIR)
    return files.filter(f => f.endsWith('.md')).map(f => f.slice(0, -3))
  } catch (err) {
    console.error('[file-store] list-notes failed:', err)
    return []
  }
})

ipcMain.handle('file-store:note-exists', async (event, noteId) => {
  if (!isValidNoteId(noteId)) return false
  const mdPath = path.join(NOTES_DIR, `${noteId}.md`)
  return fs.existsSync(mdPath)
})

// ── Image Store IPC ──────────────────────────────────────────────────────────

const ASSETS_DIR = path.join(DATA_DIR, 'assets')

/** Validate filename to prevent path injection */
function isValidFilename(name) {
  return typeof name === 'string' && /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|mov|avi|mkv|wmv|flv)$/.test(name)
}

ipcMain.handle('image:save', async (event, { dataUrl, name }) => {
  try {
    ensureDataDirs()
    fs.mkdirSync(ASSETS_DIR, { recursive: true })
    const base64 = dataUrl.replace(/^data:(image|video)\/[\w+\-.]+;base64,/, '')
    const ext = name ? name.split('.').pop() : 'png'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
    if (!isValidFilename(filename)) throw new Error('Invalid filename')
    const filePath = path.join(ASSETS_DIR, filename)
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
    return { path: `assets://${filename}` }
  } catch (err) {
    console.error('[image] save failed:', err)
    return { path: null }
  }
})

ipcMain.handle('image:read', async (event, filename) => {
  try {
    if (!isValidFilename(filename)) return null
    const filePath = guardPath(ASSETS_DIR, filename)
    if (!fs.existsSync(filePath)) return null
    const data = fs.readFileSync(filePath)
    const ext = filename.split('.').pop()
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml'
      : ext === 'mp4' ? 'video/mp4' : ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime'
      : ext === 'avi' ? 'video/x-msvideo' : ext === 'mkv' ? 'video/x-matroska'
      : ext === 'wmv' ? 'video/x-ms-wmv' : ext === 'flv' ? 'video/x-flv' : 'image/png'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch (err) {
    console.error('[image] read failed:', err)
    return null
  }
})

ipcMain.handle('image:delete', async (event, filename) => {
  try {
    if (!isValidFilename(filename)) return false
    const filePath = guardPath(ASSETS_DIR, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (err) {
    console.error('[image] delete failed:', err)
    return false
  }
})

ipcMain.handle('image:list', async () => {
  try {
    ensureDataDirs()
    fs.mkdirSync(ASSETS_DIR, { recursive: true })
    const files = fs.readdirSync(ASSETS_DIR)
    return files.filter(f => isValidFilename(f))
  } catch (err) {
    console.error('[image] list failed:', err)
    return []
  }
})

// ── File Watcher ─────────────────────────────────────────────────────────────
let watcher = null
let watcherDebounce = null

function startFileWatcher() {
  try {
    ensureDataDirs()
    watcher = fs.watch(NOTES_DIR, (eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) return
      if (watcherDebounce) clearTimeout(watcherDebounce)
      watcherDebounce = setTimeout(() => {
        const noteId = filename.slice(0, -3)
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) {
            w.webContents.send('note-file-changed', { noteId, event: eventType })
          }
        }
      }, 300)
    })
  } catch (err) {
    console.error('[main] Failed to start file watcher:', err)
  }
}

function stopFileWatcher() {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  if (watcherDebounce) {
    clearTimeout(watcherDebounce)
    watcherDebounce = null
  }
}

// ── Reminder IPC ────────────────────────────────────────────────────────────

ipcMain.handle('reminder:update', async (event, todos) => {
  if (!Array.isArray(todos)) return
  // Keep a copy of the todos list for the poller
  reminderTodos = todos
  // Clean up notifiedMap — remove entries for completed or non-existent todos
  const activeIds = new Set(todos.filter(t => !t.done && t.dueDate).map(t => t.id))
  for (const key of Object.keys(notifiedMap)) {
    const todoId = key.replace(':due', '')
    if (!activeIds.has(todoId)) {
      delete notifiedMap[key]
    }
  }
  // Re-run poll immediately with fresh data
  pollReminders()
})

// --- Register assets:// protocol for direct file serving ---
protocol.registerSchemesAsPrivileged([
  { scheme: 'assets', privileges: { bypassCSP: true, supportFetchAPI: true, corsEnabled: true, secure: true, stream: true } },
])

// ── Usage Document ──────────────────────────────────────────────────────────────

const USAGE_DOC_PATH = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..', '..'), '使用说明.md')

ipcMain.handle('usage:read', async () => {
  try {
    if (!fs.existsSync(USAGE_DOC_PATH)) return null
    return fs.readFileSync(USAGE_DOC_PATH, 'utf-8')
  } catch (err) {
    console.error('[usage] read failed:', err)
    return null
  }
})

// ── End Usage Document ──────────────────────────────────────────────────────────

// --- App lifecycle ---

app.whenReady().then(() => {
  // Register protocol handler — serves files from ASSETS_DIR directly
  protocol.handle('assets', (request) => {
    try {
      const urlStr = request.url
      const filePath = decodeURIComponent(urlStr.replace(/^assets:\/\//, ''))
      const fullPath = guardPath(ASSETS_DIR, filePath)
      if (!fs.existsSync(fullPath)) {
        return new Response(null, { status: 404, statusText: 'Not Found' })
      }
      return net.fetch(pathToFileURL(fullPath).href)
    } catch (err) {
      console.error('[protocol] assets handler error:', err)
      return new Response(null, { status: 500, statusText: 'Internal Server Error' })
    }
  })

  createMainWindow()
  createTray()
  // Start reminder polling (checks every 30s for due todos)
  startReminderScheduler()
  // Start file watcher for external edits
  startFileWatcher()
  // Start WiFi LAN sync server (port 9527)
  startSyncServer()

  // Check for updates after a short delay (give window time to load)
  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000)
  }
})

app.on('window-all-closed', () => {
  // Don't quit on window close; tray keeps running
})

app.on('before-quit', () => {
  app.isQuitting = true
  stopReminderScheduler()
  stopFileWatcher()
  stopSyncServer()
  globalShortcut.unregisterAll()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  if (win) { win.show(); win.focus() }
})
