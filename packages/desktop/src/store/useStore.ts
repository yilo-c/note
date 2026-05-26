// Re-export store and setTrashHandler from shared
export { useStore, setTrashHandler } from '@desk-notes/shared'

// ── Sync floatingNotes changes to individual .md files (Electron only) ─────
import { useStore as _useStore } from '@desk-notes/shared'
import { saveNoteToFile, deleteNoteFile } from '../utils/fileStore'
import { setSaveStatus } from './saveTracker'
import { errorStore } from './errorStore'

{
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let prevNoteIds = new Set<string>()
  let prevNotesJson = ''

  _useStore.subscribe((state) => {
    const notes = state.floatingNotes
    const notesJson = JSON.stringify(notes)
    if (notesJson === prevNotesJson) return
    prevNotesJson = notesJson

    // Debounced save to .md files
    if (saveTimer) clearTimeout(saveTimer)
    setSaveStatus('saving')
    saveTimer = setTimeout(async () => {
      for (const note of notes) {
        try {
          await saveNoteToFile(note as unknown as Record<string, unknown>)
        } catch (e: unknown) {
          console.error('[store] Failed to save note:', note.id, e)
          errorStore.error('便签保存失败，请检查磁盘空间')
        }
      }
      setSaveStatus('saved')
    }, 500)

    // Detect deleted notes and clean up files
    const currentIds = new Set(notes.map(n => n.id))
    for (const id of prevNoteIds) {
      if (!currentIds.has(id)) {
        deleteNoteFile(id).catch((e) => console.error('[useStore] deleteNoteFile failed:', e))
      }
    }
    prevNoteIds = currentIds
  })
}
