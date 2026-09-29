import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { STORE_HTML_SANDBOX, prepareStoreHtml } from '../lib/storeHtml'

interface StoreHtmlProps {
  html: string
  project: string
  docPath: string
}

const FORBID_TAGS = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'base', 'link', 'meta']

// A page kept as HTML in the store (a logo sheet, a film page): shown in a
// sandboxed frame that runs nothing, sized to its content once it loads.
export function StoreHtml({ html, project, docPath }: StoreHtmlProps) {
  const doc = useMemo(() => {
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

  // The frame never scrolls itself (overflow hidden in the base style): its
  // height follows the content as images load, so the hub page is the one scroller.
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

  return <iframe ref={frame} title="Page" className="store-frame" sandbox={STORE_HTML_SANDBOX} srcDoc={doc} style={{ height }} />
}
