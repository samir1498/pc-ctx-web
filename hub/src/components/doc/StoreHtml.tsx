import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { STORE_HTML_SANDBOX, prepareStoreHtml } from '../../doc/storeHtml'

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'base', 'link', 'meta']

// A page kept as HTML in the store: a sandboxed frame that runs nothing, sized
// to its content as it loads, so the hub page stays the one scroller.
export default function StoreHtml({ html, project, docPath }: { html: string; project: string; docPath: string }) {
  const doc = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const prepared = prepareStoreHtml(html, { project, docPath, dropHeading: true })
    return DOMPurify.sanitize(prepared, {
      WHOLE_DOCUMENT: true,
      FORBID_TAGS,
      FORBID_ATTR: ['srcdoc'],
      ADD_TAGS: ['video', 'source', 'style'],
      ADD_ATTR: ['controls', 'muted', 'playsinline', 'preload', 'poster', 'target', 'dir'],
    })
  }, [html, project, docPath])
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(480)

  useEffect(() => {
    const el = frame.current
    if (!el) return
    let observer: ResizeObserver | undefined
    const measure = () => {
      const root = el.contentDocument?.documentElement
      if (root) setHeight(Math.max(240, root.scrollHeight))
    }
    const watch = () => {
      measure()
      observer?.disconnect()
      const body = el.contentDocument?.body
      if (!body) return
      observer = new ResizeObserver(measure)
      observer.observe(body)
    }
    el.addEventListener('load', watch)
    return () => {
      el.removeEventListener('load', watch)
      observer?.disconnect()
    }
  }, [doc])

  if (!doc) return <div className="h-60 animate-pulse rounded-card bg-hover" aria-busy="true" />
  return <iframe ref={frame} title="Page" className="store-frame" sandbox={STORE_HTML_SANDBOX} srcDoc={doc} style={{ height }} />
}
