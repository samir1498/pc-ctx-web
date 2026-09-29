import { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { resolveStoreUrl } from '../lib/media'

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
  className?: string
  /** With docPath: relative pictures and sibling pages resolve against the store. */
  project?: string
  docPath?: string
}

// After sanitizing: a picture written as ../media/x becomes the media API
// URL, gets a caption from its title, and opens full size in a new tab; a
// link to a sibling .md page becomes its hub route.
function resolveReferences(html: string, project: string, docPath: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  doc.querySelectorAll('img').forEach((img) => {
    const src = resolveStoreUrl(img.getAttribute('src') ?? '', project, docPath)
    img.setAttribute('src', src)
    img.setAttribute('loading', 'lazy')
    const title = img.getAttribute('title') ?? ''
    const parentLink = img.closest('a')
    const figure = doc.createElement('figure')
    const holder = parentLink ?? img
    holder.replaceWith(figure)
    if (parentLink) {
      parentLink.setAttribute('target', '_blank')
      parentLink.setAttribute('rel', 'noreferrer')
      figure.appendChild(parentLink)
    } else {
      const a = doc.createElement('a')
      a.setAttribute('href', src)
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noreferrer')
      a.appendChild(img)
      figure.appendChild(a)
    }
    if (title) {
      const cap = doc.createElement('figcaption')
      cap.textContent = title
      figure.appendChild(cap)
      img.removeAttribute('title')
    }
    // A figure inside a paragraph is invalid HTML; lift it out.
    const p = figure.parentElement
    if (p && p.tagName === 'P' && p.childNodes.length === 1) p.replaceWith(figure)
  })
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') ?? ''
    const resolved = resolveStoreUrl(href, project, docPath)
    if (resolved !== href) a.setAttribute('href', resolved)
  })
  return doc.body.innerHTML
}

export function MarkdownContent({ body, className = '', project, docPath }: MarkdownContentProps) {
  const html = useMemo(() => {
    const clean = DOMPurify.sanitize(marked.parse(body, { async: false }) as string)
    return project && docPath ? resolveReferences(clean, project, docPath) : clean
  }, [body, project, docPath])
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
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
        mermaid.initialize({ startOnLoad: false, securityLevel: 'sandbox', theme: dark ? 'dark' : 'neutral' })
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

  return <div ref={containerRef} className={`prose reader-prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
