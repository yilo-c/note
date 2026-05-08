const BACKUP_KEY = 'desk-notes-backup'
const META_KEY = 'desk-notes-backup-meta'

interface BackupMeta {
  timestamp: number
  version: number
}

/**
 * Save current data to localStorage backup
 */
export function saveBackup(data: unknown): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(data))
    const meta: BackupMeta = { timestamp: Date.now(), version: 1 }
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // localStorage full — silently fail, backup is best-effort
  }
}

/**
 * Get the most recent backup's metadata
 */
export function getBackupMeta(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    return JSON.parse(raw) as BackupMeta
  } catch {
    return null
  }
}

/**
 * Schedule auto backup: first tick after 3s, then every 5 minutes
 * Returns cleanup function
 */
export function scheduleAutoBackup(
  getData: () => unknown,
  onTick?: (meta: BackupMeta) => void
): () => void {
  const tick = () => {
    const data = getData()
    saveBackup(data)
    const meta = getBackupMeta()
    if (meta && onTick) onTick(meta)
  }

  // First backup after 3 seconds
  const initial = setTimeout(tick, 3000)
  // Then every 5 minutes
  const interval = setInterval(tick, 5 * 60 * 1000)

  return () => {
    clearTimeout(initial)
    clearInterval(interval)
  }
}

/**
 * Get backup data from localStorage
 */
export function getBackupData<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/**
 * Download current backup as JSON file
 */
export function downloadBackup(): void {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) {
    console.warn('No backup data to download')
    return
  }

  const blob = new Blob([raw], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  a.download = `思忆便签-备份-${ts}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Restore data from localStorage backup
 */
export function restoreFromBackup<T = unknown>(): T | null {
  return getBackupData<T>()
}
