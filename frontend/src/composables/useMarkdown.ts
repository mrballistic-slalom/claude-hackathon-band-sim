import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  breaks: true,
  gfm: true,
})

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre',
  'blockquote', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'del', 's',
]

const ALLOWED_ATTR = ['href', 'target', 'rel']

export function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })
}
