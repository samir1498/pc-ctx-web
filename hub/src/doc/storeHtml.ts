import { resolveStoreUrl } from './media'

/**
 * The iframe sandbox for a page kept as HTML in a store. No allow-scripts:
 * the document can only be looked at. allow-same-origin lets the shell read
 * its height; with nothing able to run inside, that is safe.
 */
export const STORE_HTML_SANDBOX = 'allow-same-origin allow-popups allow-popups-to-escape-sandbox'

const SCRIPT_RE = /<script\b[\s\S]*?<\/script\s*>|<script\b[^>]*\/?>/gi
const DANGEROUS_TAG_RE = /<\/?(?:iframe|object|embed|frame|frameset|form|input|button|textarea|select|base|meta|link)\b[^>]*>/gi
const ON_ATTR_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const URL_ATTR_RE = /(\s(?:src|href|poster|data)\s*=\s*)("([^"]*)"|'([^']*)')/gi
const JS_URL_RE = /^\s*(?:javascript|vbscript|data:text\/html)/i

export interface StoreHtmlOptions {
  project: string
  docPath: string
  /** Drop the first h1 and the lede paragraph: the shell shows them as the page title. */
  dropHeading?: boolean
}

// The reader's own type and colours, so a fragment written for another site
// reads like the rest of the hub. A page that brings its own <style> keeps it.
const BASE_CSS = `
:root{color-scheme:light dark}
html,body{margin:0;background:transparent;overflow:hidden}
body{font:16px/1.6 Inter,system-ui,sans-serif;color:#1c1c1a;max-width:46rem;padding:0 0 1rem}
@media (prefers-color-scheme:dark){body{color:#e6e6e2}}
img,video,svg{max-width:100%;height:auto}
a{color:#1d54b8}
`

/**
 * First pass over a stored HTML page, before DOMPurify and the sandbox: no
 * scripts, no handlers, no embeds, and every relative picture pointed at the
 * media API. Pure string work so it is testable without a DOM.
 */
export function prepareStoreHtml(html: string, opts: StoreHtmlOptions): string {
  let out = html.replace(/<!--[\s\S]*?-->/g, '')
  // A full document collapses to its body; a fragment is used as is.
  const body = out.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
  const headStyles = body ? (out.match(/<style\b[\s\S]*?<\/style>/gi) ?? []).join('\n') : ''
  if (body) out = `${headStyles}\n${body}`
  out = out.replace(SCRIPT_RE, '').replace(DANGEROUS_TAG_RE, '').replace(ON_ATTR_RE, '')
  out = out.replace(URL_ATTR_RE, (_m, lead: string, _q: string, dq?: string, sq?: string) => {
    const raw = dq ?? sq ?? ''
    if (JS_URL_RE.test(raw)) return `${lead}""`
    return `${lead}"${resolveStoreUrl(raw, opts.project, opts.docPath)}"`
  })
  if (opts.dropHeading) {
    out = out.replace(/<p[^>]*class="[^"]*\beyebrow\b[^"]*"[^>]*>[\s\S]*?<\/p>\s*/i, '')
    out = out.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '')
    out = out.replace(/<p[^>]*class="[^"]*\blede\b[^"]*"[^>]*>[\s\S]*?<\/p>\s*/i, '')
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${out}</body></html>`
}
