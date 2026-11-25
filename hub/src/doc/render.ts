import { Marked, type Tokens } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import sanitizeHtml from 'sanitize-html'
import { resolveStoreUrl } from './media'

// Only the languages the stores use (counted 2026-09-30); the full set is ~1 MB of worker.
const LANGS = { bash, css, diff, dockerfile, javascript, json, markdown, rust, sql, typescript, xml, yaml }
for (const [name, lang] of Object.entries(LANGS)) hljs.registerLanguage(name, lang)
hljs.registerAliases(['sh', 'shell', 'zsh'], { languageName: 'bash' })
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' })
hljs.registerAliases(['js', 'jsx', 'mjs'], { languageName: 'javascript' })
hljs.registerAliases(['html', 'svg'], { languageName: 'xml' })
hljs.registerAliases(['yml', 'toml'], { languageName: 'yaml' })
hljs.registerAliases(['md', 'mdx'], { languageName: 'markdown' })

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'figure', 'figcaption', 'del', 'ins', 'details', 'summary', 'input', 'span', 'h1', 'h2'],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'loading'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
    input: ['type', 'checked', 'disabled'],
    th: ['align'],
    td: ['align'],
    '*': ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
  transformTags: {
    input: (tagName, attribs) => (attribs.type === 'checkbox' ? { tagName, attribs: { ...attribs, disabled: '' } } : { tagName: 'span', attribs: {} }),
  },
}

const SHORT_TOKEN_RE = /^[\w-]{1,16}$/

/** A name as an anchor: lower case words joined by dashes. */
export function slugId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** A picture's anchor: its alt text when that is a short token (![u08] gives #u08), else its file name. */
export function pictureId(alt: string, href: string): string {
  if (SHORT_TOKEN_RE.test(alt)) return alt
  const file = href.split(/[?#]/)[0]?.split('/').pop() ?? ''
  return slugId(file.replace(/\.\w+$/, ''))
}

/** Markdown to safe HTML: pictures and sibling pages resolve against the store; mermaid stays as source for the island. */
export function renderMarkdown(body: string, ctx?: { project: string; docPath: string }): string {
  const resolve = (href: string) => (ctx ? resolveStoreUrl(href, ctx.project, ctx.docPath) : href)
  const md = new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        if (lang === 'mermaid') return escape(code)
        return lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : escape(code)
      },
    }),
  )
  // Ids already on the page (a hand-written <a id="u01"></a> before a picture) are never given twice.
  const taken = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] ?? ''))
  const figureId = (alt: string, href: string) => {
    const base = pictureId(alt, href)
    if (!base) return ''
    if (taken.has(base)) return ''
    taken.add(base)
    return ` id="${escape(base)}"`
  }
  md.use(gfmHeadingId())
  md.use({
    gfm: true,
    renderer: {
      image({ href, title, text }: Tokens.Image) {
        const src = escape(resolve(href))
        const cap = title ? `<figcaption>${escape(title)}</figcaption>` : ''
        return `<figure${figureId(text, href)}><a href="${src}" target="_blank" rel="noreferrer"><img src="${src}" alt="${escape(text)}" loading="lazy"></a>${cap}</figure>`
      },
      link(this: { parser: { parseInline(t: Tokens.Generic[]): string } }, { href, title, tokens }: Tokens.Link) {
        const t = title ? ` title="${escape(title)}"` : ''
        const external = /^https?:/i.test(href) ? ' target="_blank" rel="noreferrer"' : ''
        return `<a href="${escape(resolve(href))}"${t}${external}>${this.parser.parseInline(tokens)}</a>`
      },
    },
  })
  const html = md.parse(body, { async: false })
  // A figure alone in a paragraph is invalid HTML; lift it out.
  return sanitizeHtml(html, SANITIZE).replace(/<p>\s*(<figure[^>]*>[\s\S]*?<\/figure>)\s*<\/p>/g, '$1')
}
