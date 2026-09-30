import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../render'

const ctx = { project: 'observeone', docPath: 'reports/2026-09-30-x.md' }

describe('renderMarkdown', () => {
  it('drops scripts, handlers and javascript: links', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))')
    expect(html).not.toMatch(/<script|onerror|javascript:/i)
  })

  it('points a store picture at the media route, in a figure with its caption', () => {
    const html = renderMarkdown('![Home](../media/shots/home.png "The home page")', ctx)
    expect(html).toContain('src="/api/p/observeone/media/shots/home.png"')
    expect(html).toContain('<figcaption>The home page</figcaption>')
    expect(html).not.toMatch(/<p>\s*<figure>/)
  })

  it('turns a link to a sibling plan into its hub route', () => {
    expect(renderMarkdown('[plan](../plans/20260929-x.md)', ctx)).toContain('href="/p/observeone/plan/20260929-x"')
  })

  it('highlights known languages and leaves mermaid as escaped source', () => {
    const html = renderMarkdown('```ts\nconst a = 1\n```\n\n```mermaid\ngraph TD; A-->B\n```')
    expect(html).toContain('hljs-keyword')
    expect(html).toContain('language-mermaid')
    expect(html).toContain('A--&gt;B')
  })
})
