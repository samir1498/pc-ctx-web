import { useMemo } from 'react'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return code
  }
}))

interface MarkdownContentProps {
  body: string
}

export function MarkdownContent({ body }: MarkdownContentProps) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(body, { async: false }) as string), [body])

  return (
    <div
      className="prose prose-sm max-w-none prose-invert prose-headings:text-foreground prose-a:text-blue prose-strong:text-foreground prose-code:before:content-none prose-code:after:content-none prose-hr:border-border prose-code:font-normal"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
