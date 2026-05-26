import DOMPurify from 'dompurify'

// For editor and display content — preserves rich text formatting
// while stripping XSS vectors (scripts, event handlers, javascript: URLs)
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'u', 's', 'em', 'strong', 'a', 'img', 'video',
      'ul', 'ol', 'li', 'br', 'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'code', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'sub', 'sup', 'mark', 'del', 'ins', 'small',
      'figure', 'figcaption', 'caption', 'col', 'colgroup',
      'dl', 'dt', 'dd', 'abbr', 'address',
      'font', 'strike', 'center',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
      'class', 'id', 'style', 'data-asset', 'controls', 'type', 'start',
      'colspan', 'rowspan', 'scope', 'loading',
    ],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'],
  })
}
