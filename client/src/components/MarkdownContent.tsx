import { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    // Leave mermaid source untouched; it is turned into a diagram client-side
    // (see the effect below) rather than syntax-highlighted.
    if (lang === 'mermaid') return code
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return code
  }
}))

// mermaid is large (~2 MB), so it is dynamically imported only when a page
// actually contains a diagram — most docs don't, keeping the main bundle lean.
let mermaidReady = false

interface MarkdownContentProps {
  body: string
}

export function MarkdownContent({ body }: MarkdownContentProps) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(body, { async: false }) as string), [body])
  const containerRef = useRef<HTMLDivElement>(null)

  // marked emits ```mermaid fences as <pre><code class="hljs language-mermaid">.
  // DOMPurify keeps that text; mermaid injects <svg>/<foreignObject> which
  // DOMPurify would strip, so we let mermaid render into the DOM *after*
  // sanitization instead of running its SVG back through DOMPurify.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const blocks = root.querySelectorAll('code.language-mermaid')
    if (blocks.length === 0) return

    const targets: HTMLElement[] = []
    blocks.forEach((code) => {
      const host = code.closest('pre') ?? code
      const div = document.createElement('div')
      div.className = 'mermaid'
      div.textContent = code.textContent ?? ''
      host.replaceWith(div)
      targets.push(div)
    })

    let cancelled = false
    void import('mermaid').then(({ default: mermaid }) => {
      if (cancelled) return
      if (!mermaidReady) {
        // securityLevel 'sandbox' renders each diagram inside a sandboxed
        // <iframe>, fully isolating mermaid's post-DOMPurify SVG from the page
        // (defense in depth; diagram source is repo markdown). startOnLoad off:
        // we drive rendering here.
        mermaid.initialize({ startOnLoad: false, securityLevel: 'sandbox', theme: 'dark' })
        mermaidReady = true
      }
      return mermaid.run({ nodes: targets })
    }).catch(() => {
      // Import or parse failure: leave the raw diagram source visible.
    })

    return () => {
      cancelled = true
    }
  }, [html])

  return (
    <div
      ref={containerRef}
      className="prose prose-sm max-w-none prose-invert prose-headings:text-foreground prose-a:text-blue prose-strong:text-foreground prose-code:before:content-none prose-code:after:content-none prose-hr:border-border prose-code:font-normal"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
