import React, { Suspense } from 'react'
import type { FloatingNote as FN } from '../../types'
import { useStore } from '../../store/useStore'
import { onContentEdit } from '../../store/contentEditTracker'
import { useTranslation } from '../../i18n'
import { formatDueDate } from './FloatingNote.utils'
import FormatToolbar from './FormatToolbar'
import AIToolbar from './AIToolbar'
import type { AIAction } from '../../utils/ai/types'

const MdPreview = React.lazy(() => import('./MdPreview'))

interface NoteContentProps {
  note: FN
  isArchived: boolean | undefined
  nd: React.CSSProperties | undefined
  editorRef: React.RefObject<HTMLDivElement>
  fmtToolbar: { x: number; y: number; visible: boolean }
  aiToolbar: { x: number; y: number; visible: boolean; text: string }
  linkToolbar: { x: number; y: number; visible: boolean; url: string; node: HTMLAnchorElement | null }
  wc: { count: number; label: string }
  wcText: string
  showFormatBar: boolean
  viewMode: 'edit' | 'preview' | 'split'
  editMode: 'richtext' | 'markdown'
  mdContent: string
  backlinks: FN[]
  showBacklinks: boolean
  todoText: string
  onFmtToolbarChange: (v: { x: number; y: number; visible: boolean }) => void
  onAiToolbarChange: (v: { x: number; y: number; visible: boolean; text: string }) => void
  onLinkToolbarChange: (v: { x: number; y: number; visible: boolean; url: string; node: HTMLAnchorElement | null }) => void
  onShowFormatBarChange: (v: boolean) => void
  onViewModeChange: (mode: 'edit' | 'preview' | 'split') => void
  onEditModeChange: (mode: 'richtext' | 'markdown') => void
  onMdContentChange: (v: string) => void
  onShowBacklinksChange: (v: boolean) => void
  onShowChatPanelChange: (v: boolean) => void
  onTodoTextChange: (v: string) => void
  onExtractTodos: () => void
  onAddTodo: () => void
  onToggleTodo: (id: string) => void
  onDeleteTodo: (id: string) => void
  onRenderTodoText: (text: string) => React.ReactNode
  onTextInput: () => void
  onTextSelect: () => void
  onTextareaSelect?: (text: string, rect: DOMRect | null) => void
  onPaste: (e: React.ClipboardEvent) => void
  onDrop: (e: React.DragEvent) => void
  onEditorMouseDown: (e: React.MouseEvent) => void
  onImageDblClick: (e: React.MouseEvent) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onAIReplace: (text: string, action: AIAction) => void
}

const FloatingNoteContent: React.FC<NoteContentProps> = ({
  note, isArchived, nd, editorRef,
  fmtToolbar, aiToolbar, linkToolbar, wc, wcText,
  showFormatBar, viewMode, editMode, mdContent, backlinks, showBacklinks, todoText,
  onFmtToolbarChange, onAiToolbarChange, onLinkToolbarChange,
  onShowFormatBarChange,
  onViewModeChange, onEditModeChange, onMdContentChange,
  onShowBacklinksChange, onShowChatPanelChange,
  onTodoTextChange, onExtractTodos, onAddTodo, onToggleTodo, onDeleteTodo, onRenderTodoText,
  onTextInput, onTextSelect, onTextareaSelect, onPaste, onDrop, onEditorMouseDown, onImageDblClick, onKeyDown,
  onAIReplace,
}) => {
  const updateFloatingNote = useStore(s => s.updateFloatingNote)
  const { t } = useTranslation()

  return (
    <div className="flex-1 min-h-0 flex flex-col relative select-text" style={nd}>
      <div className="flex-1 min-h-0" style={{
        display: note.collapsed ? 'none' : undefined,
        overflowY: 'auto',
      }}>
        {note.type === 'text' ? (
          <div className="w-full h-full flex flex-col">
            {/* Floating format toolbar */}
            <FormatToolbar
              x={fmtToolbar.x}
              y={fmtToolbar.y}
              visible={fmtToolbar.visible && !aiToolbar.visible}
              containerEl={editorRef.current || document.body}
              onClose={() => onFmtToolbarChange({ ...fmtToolbar, visible: false })}
              noteId={note.id}
            />
            {/* AI toolbar */}
            <AIToolbar
              x={aiToolbar.x}
              y={aiToolbar.y}
              visible={aiToolbar.visible}
              selectedText={aiToolbar.text}
              noteTitle={note.title}
              containerEl={editorRef.current || document.body}
              onClose={() => onAiToolbarChange({ ...aiToolbar, visible: false, text: '' })}
              onReplace={onAIReplace}
              onOpenChat={() => onShowChatPanelChange(true)}
            />
            {/* Link edit toolbar */}
            {linkToolbar.visible && (
              <div
                className="fixed z-[9999] flex items-center gap-1.5 bg-[rgba(28,28,38,0.95)] border border-white/[0.08] rounded-lg px-2 py-1.5 shadow-2xl backdrop-blur-xl"
                style={{
                  left: linkToolbar.x,
                  top: linkToolbar.y - 36,
                  transform: 'translateX(-50%)',
                }}
                onMouseDown={e => e.preventDefault()}
              >
                <span className="text-[10px] text-white/55 max-w-[140px] truncate">{linkToolbar.url}</span>
                <button
                  onClick={() => {
                    const newUrl = prompt(t('formatToolbar.editLink'), linkToolbar.url)
                    if (newUrl && linkToolbar.node) {
                      linkToolbar.node.href = newUrl
                      onContentEdit(note.id)
                      updateFloatingNote(note.id, { content: editorRef.current?.innerHTML || '' })
                    }
                    onLinkToolbarChange({ ...linkToolbar, visible: false })
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-[9px] text-white/55 hover:text-white hover:bg-white/[0.06] transition-all"
                  title={t('formatToolbar.editLink')}
                >
                  <i className="fa-solid fa-pen" />
                </button>
                <button
                  onClick={() => {
                    document.execCommand('unlink')
                    onContentEdit(note.id)
                    updateFloatingNote(note.id, { content: editorRef.current?.innerHTML || '' })
                    onLinkToolbarChange({ ...linkToolbar, visible: false })
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded text-[9px] text-white/55 hover:text-red-400/60 hover:bg-white/[0.06] transition-all"
                  title={t('formatToolbar.unlink')}
                >
                  <i className="fa-solid fa-link-slash" />
                </button>
              </div>
            )}
            {/* Fixed format toolbar */}
            <FormatToolbar
              x={0} y={0}
              visible={showFormatBar && !note.collapsed}
              containerEl={editorRef.current || document.body}
              onClose={() => onShowFormatBarChange(false)}
              fixed
              fontSize={note.fontSize}
              onFontSizeChange={s => updateFloatingNote(note.id, { fontSize: s })}
              viewMode={viewMode}
              editMode={editMode}
              onViewModeChange={onViewModeChange}
              onEditModeChange={onEditModeChange}
              noteId={note.id}
              onOpenChat={() => onShowChatPanelChange(true)}
            />
            {viewMode === 'preview' ? (
              <Suspense fallback={null}><MdPreview
                content={editMode === 'markdown' ? mdContent : (note.content || '')}
                isHtml={editMode !== 'markdown'}
                className="flex-1"
              /></Suspense>
            ) : viewMode === 'split' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 min-h-0 flex flex-col border-b border-white/[0.06]">
                  {editMode === 'markdown' ? (
                    <textarea
                      value={mdContent}
                      onChange={e => {
                        onMdContentChange(e.target.value)
                        onContentEdit(note.id)
                        updateFloatingNote(note.id, { content: e.target.value })
                      }}
                      className="flex-1 bg-transparent px-3 py-2 outline-none resize-none text-sm leading-relaxed font-mono"
                      style={{ color: 'var(--text-primary)' }}
                      placeholder={t('note.markdownPlaceholder')}
                      onMouseUp={e => {
                        if (!onTextareaSelect) return
                        const ta = e.currentTarget
                        const text = ta.value.substring(ta.selectionStart, ta.selectionEnd)
                        if (text.trim().length >= 10) { const rect = ta.getBoundingClientRect(); onTextareaSelect(text.trim(), rect) }
                        else { onTextareaSelect('', null) }
                      }}
                      onKeyUp={e => {
                        if (!onTextareaSelect) return
                        const ta = e.currentTarget
                        const text = ta.value.substring(ta.selectionStart, ta.selectionEnd)
                        if (text.trim().length >= 10) { const rect = ta.getBoundingClientRect(); onTextareaSelect(text.trim(), rect) }
                        else { onTextareaSelect('', null) }
                      }}
                    />
                  ) : (
                    <div
                      ref={editorRef}
                      contentEditable={!note.locked && !isArchived}
                      suppressContentEditableWarning
                      onInput={onTextInput}
                      onMouseDown={onEditorMouseDown}
                      onDoubleClick={onImageDblClick}
                      onMouseUp={onTextSelect}
                      onKeyUp={onTextSelect}
                      onPaste={onPaste}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                      onDrop={onDrop}
                      onKeyDown={onKeyDown}
                      style={{ color: 'var(--text-primary)', fontSize: (note.fontSize || 14) + 'px', userSelect: 'text', WebkitUserSelect: 'text' }}
                      className="flex-1 bg-transparent leading-relaxed px-3 py-2 outline-none overflow-auto
                        [&_a]:text-fluent-blue [&_a]:underline
                        [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]
                        [&_blockquote]:border-l-2 [&_blockquote]:border-white/[0.12] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-white/72 [&_blockquote]:my-1
                        [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-1.5 [&_img]:border [&_img]:border-white/[0.06]
                        [&_.image-caption]:text-[9px] [&_.image-caption]:text-white/50 [&_.image-caption]:text-center [&_.image-caption]:italic
                        break-words
                        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                        [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
                        [&_li]:mb-0.5"
                    />
                  )}
                </div>
                <Suspense fallback={null}><MdPreview
                  content={editMode === 'markdown' ? mdContent : (note.content || '')}
                  isHtml={editMode !== 'markdown'}
                  className="flex-1 min-h-[60px]"
                /></Suspense>
              </div>
            ) : (
              <>
                {editMode === 'markdown' ? (
                  <textarea
                    value={mdContent}
                    onChange={e => {
                      onMdContentChange(e.target.value)
                      onContentEdit(note.id)
                      updateFloatingNote(note.id, { content: e.target.value })
                    }}
                    className="flex-1 bg-transparent px-3 py-2 outline-none resize-none text-sm leading-relaxed font-mono"
                    style={{ color: 'var(--text-primary)', fontSize: (note.fontSize || 14) + 'px' }}
                    placeholder={t('note.markdownPlaceholder')}
                    onMouseUp={e => {
                      if (!onTextareaSelect) return
                      const ta = e.currentTarget
                      const text = ta.value.substring(ta.selectionStart, ta.selectionEnd)
                      if (text.trim().length >= 10) { const rect = ta.getBoundingClientRect(); onTextareaSelect(text.trim(), rect) }
                      else { onTextareaSelect('', null) }
                    }}
                    onKeyUp={e => {
                      if (!onTextareaSelect) return
                      const ta = e.currentTarget
                      const text = ta.value.substring(ta.selectionStart, ta.selectionEnd)
                      if (text.trim().length >= 10) { const rect = ta.getBoundingClientRect(); onTextareaSelect(text.trim(), rect) }
                      else { onTextareaSelect('', null) }
                    }}
                  />
                ) : (
                  <div
                    ref={editorRef}
                    contentEditable={!note.locked && !isArchived}
                    suppressContentEditableWarning
                    onInput={onTextInput}
                    onMouseDown={onEditorMouseDown}
                    onDoubleClick={onImageDblClick}
                    onMouseUp={onTextSelect}
                    onKeyUp={onTextSelect}
                    onPaste={onPaste}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                    onDrop={onDrop}
                    onKeyDown={onKeyDown}
                    style={{ color: 'var(--text-primary)', fontSize: (note.fontSize || 14) + 'px', userSelect: 'text', WebkitUserSelect: 'text' }}
                    className="flex-1 bg-transparent leading-relaxed px-3 py-2 outline-none overflow-auto
                      [&_a]:text-fluent-blue [&_a]:underline
                      [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]
                      [&_blockquote]:border-l-2 [&_blockquote]:border-white/[0.12] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-white/72 [&_blockquote]:my-1
                      [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-1.5 [&_img]:border [&_img]:border-white/[0.06]
                      [&_.image-caption]:text-[9px] [&_.image-caption]:text-white/50 [&_.image-caption]:text-center [&_.image-caption]:italic
                      break-words
                      [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
                      [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4
                      [&_li]:mb-0.5"
                  />
                )}
              </>
            )}
            {/* Word count + extract todos */}
            {viewMode !== 'preview' && (editMode !== 'markdown' || viewMode === 'edit') && (
              <div className="flex items-center justify-between px-3 py-1 border-t border-white/[0.04]">
                <button
                  onClick={onExtractTodos}
                  className="flex items-center gap-1 text-[9px] transition-all hover:text-white/72"
                  style={{ color: 'var(--text-muted)' }}
                  title={t('note.extractTodosTooltip')}
                >
                  <i className="fa-solid fa-list-check text-[8px]" />
                  <span>{t('note.extractTodosBtn')}</span>
                </button>
                <span className={`text-[10px] ${wc.count > 5000 ? 'text-red-400' : wc.count > 1000 ? 'text-yellow-400' : ''}`}
                  style={wc.count <= 1000 ? { color: 'var(--text-muted)' } : undefined}>
                  {editMode === 'markdown' ? t('note.charCount', { count: mdContent.length }) : wcText}
                </span>
              </div>
            )}
            {/* Embedded todo list in text notes */}
            {(note.todos || []).length > 0 && (
              <div className="border-t border-white/[0.04] px-3 py-1.5">
                {(note.todos || []).map(t => (
                  <div key={t.id} className="group flex items-center gap-2 py-0.5">
                    <button onClick={() => onToggleTodo(t.id)}
                      className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 transition-all ${t.done ? 'bg-fluent-blue/20 border-fluent-blue/30' : 'border-white/20 hover:border-white/40'}`}>
                      {t.done && <svg className="w-1.5 h-1.5 text-fluent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <span className={`flex-1 text-[10px] ${t.done ? 'line-through' : ''}`}
                      style={{ color: t.done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                      {t.text}
                    </span>
                    <button onClick={() => onDeleteTodo(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/55 hover:text-red-400/50 transition-all text-[8px]">
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-3 py-2">
            {(note.todos || []).map(t => (
              <div key={t.id} className="group flex items-center gap-2 py-1.5 rounded hover:bg-white/[0.03] transition-colors">
                <button onClick={() => onToggleTodo(t.id)}
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${t.done ? 'bg-fluent-blue/20 border-fluent-blue/30' : 'border-white/20 hover:border-white/40'}`}>
                  {t.done && <svg className="w-2 h-2 text-fluent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </button>
                {t.priority !== undefined && (
                  <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                    style={{ background: t.priority === 0 ? '#f87171' : t.priority === 1 ? '#fbbf24' : '#64748b' }} />
                )}
                <span className={`flex-1 text-xs ${t.done ? 'line-through' : ''}`}
                  style={{ color: t.done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                  {onRenderTodoText(t.text)}
                </span>
                {t.dueDate && (
                  <span className="text-[9px] text-white/40 flex-shrink-0">{formatDueDate(t.dueDate)}</span>
                )}
                <button onClick={() => onDeleteTodo(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-white/55 hover:text-red-400/50 transition-all text-[9px]">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/[0.04]">
              <input value={todoText} onChange={e => onTodoTextChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onAddTodo()}
                placeholder={t('note.addTodoPlaceholder')}
                disabled={isArchived || note.locked}
                className="flex-1 bg-transparent text-xs text-white/80 placeholder:text-white/55 outline-none disabled:opacity-40" />
              {todoText.trim() && (
                <button onClick={onAddTodo} className="text-[10px] text-white/72 hover:text-white/72 transition-colors">{t('note.addTodoBtn')}</button>
              )}
            </div>
          </div>
        )}
        {/* Backlinks panel */}
        {backlinks.length > 0 && (
          <div className="border-t border-white/[0.04]">
            <button
              onClick={() => onShowBacklinksChange(!showBacklinks)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-white/45 hover:text-white/70 transition-colors"
            >
              <i className={`fa-solid fa-chevron-right text-[8px] transition-transform ${showBacklinks ? 'rotate-90' : ''}`} />
              {t('note.referencedBy')} ({backlinks.length})
            </button>
            {showBacklinks && (
              <div className="px-3 pb-2 space-y-0.5 max-h-32 overflow-y-auto">
                {backlinks.slice(0, 50).map(n => (
                  <button
                    key={n.id}
                    onClick={() => {
                      useStore.getState().focusNote(n.id)
                      onShowBacklinksChange(false)
                    }}
                    className="block w-full text-left text-[11px] text-fluent-blue/70 hover:text-fluent-blue truncate transition-colors py-0.5"
                  >
                    {n.title || t('note.newNote')}
                  </button>
                ))}
                {backlinks.length > 50 && (
                  <div className="text-[10px] text-white/35 pt-0.5">
                    {t('note.moreBacklinks', { count: backlinks.length - 50 })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FloatingNoteContent
