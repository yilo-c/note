export interface TrashItem {
  id: string
  type: 'todo' | 'note'
  data: unknown
  deletedAt: number
}

const TRASH_KEY = 'desk-notes-trash'

// Notify subscribers on every mutation so consumers can refresh.
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach(fn => fn())
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function loadTrash(): TrashItem[] {
  try {
    const raw = localStorage.getItem(TRASH_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TrashItem[]
  } catch {
    return []
  }
}

function saveTrash(items: TrashItem[]): void {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(items))
  } catch (e) {
    console.error('[trash] localStorage write FAILED:', e)
  }
}

export function moveToTrash(item: TrashItem): void {
  const items = loadTrash()
  const filtered = items.filter(i => i.id !== item.id)
  filtered.push(item)
  saveTrash(filtered)
  notify()
}

export function restoreFromTrash(id: string): TrashItem | null {
  const items = loadTrash()
  const idx = items.findIndex(i => i.id === id)
  if (idx === -1) return null
  const [item] = items.splice(idx, 1)
  saveTrash(items)
  notify()
  return item
}

export function permanentlyDelete(id: string): void {
  const items = loadTrash().filter(i => i.id !== id)
  saveTrash(items)
  notify()
}

export function clearTrash(): void {
  saveTrash([])
  notify()
}

export function getTrashItems(): TrashItem[] {
  return loadTrash()
}
