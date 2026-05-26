import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../i18n'
import { WIKI_LINK_REGEX, resolveWikiLink } from '../../utils/wikiLinks'
import { sanitizeHtml } from '../../utils/sanitize'

interface MdPreviewProps {
  content: string
  /** When true, render HTML raw (for richtext mode preview) */
  isHtml?: boolean
  className?: string
}

const MdPreview: React.FC<MdPreviewProps> = ({ content, isHtml, className }) => {
  const floatingNotes = useStore(s => s.floatingNotes)
  const { t } = useTranslation()

  const preview = useMemo(() => {
    if (isHtml) {
      const sanitized = sanitizeHtml(content)
      return (
        <div
          className="prose prose-invert prose-sm max-w-none [&_a]:text-fluent-blue [&_a]:underline
            [&_code]:bg-white/[0.08] [&_code]:px-1 [&_code]:rounded [&_code]:text-[11px]
            [&_blockquote]:border-l-2 [&_blockquote]:border-white/[0.12] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-white/72
            [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-1.5
            [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2
            [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      )
    }

    // Preprocess [[wiki links]] —?markdown links
    const noteStubs = floatingNotes.map(n => ({ id: n.id, title: n.title }))
    const preprocessed = content.replace(WIKI_LINK_REGEX, (_full, title: string, display?: string) => {
      const linkTitle = title.trim()
      const displayText = (display || linkTitle).trim()
      const resolved = resolveWikiLink(linkTitle, noteStubs)
      if (resolved) {
        return `[${displayText}](#ref-${resolved.id})`
      }
      return `${displayText}`
    })

    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className: cn, children, ...props }) {
              const match = /language-(\w+)/.exec(cn || '')
              const codeStr = String(children).replace(/\n$/, '')
              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0, borderRadius: '8px',
                      fontSize: '11px', background: 'rgba(0,0,0,0.3)',
                    }}
                  >
                    {codeStr}
                  </SyntaxHighlighter>
                )
              }
              return (
                <code className="bg-white/[0.08] px-1 rounded text-[11px]" {...props}>
                  {children}
                </code>
              )
            },
            a({ href, children }) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-fluent-blue underline">
                  {children}
                </a>
              )
            },
            img({ src, alt }) {
              return (
                <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg my-1.5 border border-white/[0.06]" />
              )
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-white/[0.12] pl-3 italic text-white/72 my-1">
                  {children}
                </blockquote>
              )
            },
          }}
        >
          {preprocessed}
        </ReactMarkdown>
      </div>
    )
  }, [content, isHtml, floatingNotes])

  return (
    <div className={`px-3 py-2 overflow-auto text-sm leading-relaxed ${className || ''}`}
      style={{ color: 'var(--text-primary)' }}>
      {content.trim() ? preview : (
        <span className="text-white/30 text-xs italic">{t('note.noContent')}</span>
      )}
    </div>
  )
}

export default React.memo(MdPreview)
