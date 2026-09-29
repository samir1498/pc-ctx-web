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

  useEffect(() => {
    const el = frame.current
    if (!el) return
    const measure = () => {
      const body = el.contentDocument?.documentElement
      if (body) setHeight(Math.max(240, body.scrollHeight + 8))
    }
    el.addEventListener('load', measure)
    window.addEventListener('resize', measure)
    const again = window.setTimeout(measure, 800)
    return () => {
      el.removeEventListener('load', measure)
      window.removeEventListener('resize', measure)
      window.clearTimeout(again)
    }
  }, [doc])

  return <iframe ref={frame} title="Page" className="store-frame" sandbox={STORE_HTML_SANDBOX} srcDoc={doc} style={{ height }} />
}
