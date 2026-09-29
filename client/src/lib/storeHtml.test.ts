import { describe, expect, it } from 'vitest'
import { mediaUrl, resolveStorePath, resolveStoreUrl } from './media'
import { STORE_HTML_SANDBOX, prepareStoreHtml } from './storeHtml'

const opts = { project: 'dinar', docPath: 'designs/e-logo.html' }

describe('a page kept as HTML renders in a sandbox that runs nothing', () => {
  it('never grants scripts to the frame', () => {
    expect(STORE_HTML_SANDBOX.split(' ')).not.toContain('allow-scripts')
    expect(STORE_HTML_SANDBOX.split(' ')).not.toContain('allow-forms')
    expect(STORE_HTML_SANDBOX).toContain('allow-same-origin')
  })

  it('strips scripts, handlers, embeds and javascript: links before the frame sees the page', () => {
    const html = '<p onclick="steal()">Hi</p><script>alert(1)</script><iframe src="https://x"></iframe><a href="javascript:alert(1)">x</a><form><input></form><img src="x.png" onerror="go()">'
    const out = prepareStoreHtml(html, opts)
    expect(out).not.toMatch(/<script|<iframe|<form|<input|onclick|onerror|javascript:/)
    expect(out).toContain('<p>Hi</p>')
  })

  it('points relative pictures at the media API and keeps absolute ones', () => {
    const html = '<img src="../media/screens/till.webp"><video src="https://cdn.example/clip.mp4" poster="../media/demo/p.jpg"></video><a href="../reports/20260924-shop-test-day.md">day</a>'
    const out = prepareStoreHtml(html, opts)
    expect(out).toContain('src="/api/p/dinar/media/screens/till.webp"')
    expect(out).toContain('src="https://cdn.example/clip.mp4"')
    expect(out).toContain('poster="/api/p/dinar/media/demo/p.jpg"')
    expect(out).toContain('href="/p/dinar/reports/20260924-shop-test-day"')
  })

  it('drops the heading and lede the shell already shows, and keeps the page style', () => {
    const html = '<style>.page{max-width:640px}</style><div class="page"><p class="eyebrow">Dinar</p><h1>Logo</h1><p class="lede">One mark.</p><p>Body.</p></div>'
    const out = prepareStoreHtml(html, { ...opts, dropHeading: true })
    expect(out).not.toContain('<h1>')
    expect(out).not.toContain('One mark.')
    expect(out).not.toContain('eyebrow')
    expect(out).toContain('.page{max-width:640px}')
    expect(out).toContain('<p>Body.</p>')
    expect(out.startsWith('<!doctype html>')).toBe(true)
  })

  it('takes the body of a full document', () => {
    const out = prepareStoreHtml('<html><head><title>T</title><style>b{}</style></head><body><b>x</b></body></html>', opts)
    expect(out).toContain('<b>x</b>')
    expect(out).toContain('<style>b{}</style>')
    expect(out).not.toContain('<title>')
  })
})

describe('store-relative references', () => {
  it('resolves against the page folder', () => {
    expect(resolveStorePath('reports/x.md', '../media/a.png')).toBe('media/a.png')
    expect(resolveStorePath('progress/standup/2026-09-22.md', '../../media/a.png')).toBe('media/a.png')
    expect(resolveStorePath('designs/screens.md', 'lumina-till.md')).toBe('designs/lumina-till.md')
  })

  it('maps media to the API and sibling pages to hub routes', () => {
    expect(mediaUrl('dinar', 'screens/a b.png')).toBe('/api/p/dinar/media/screens/a%20b.png')
    expect(resolveStoreUrl('../media/screens/till.webp', 'dinar', 'reports/x.md')).toBe('/api/p/dinar/media/screens/till.webp')
    expect(resolveStoreUrl('20260920-lumina-till.md', 'dinar', 'research/20260920-lumina-taken-apart.md')).toBe('/p/dinar/research/20260920-lumina-till')
    expect(resolveStoreUrl('../plans/20260924-shop.md#tasks', 'dinar', 'reports/x.md')).toBe('/p/dinar/plan/20260924-shop#tasks')
    expect(resolveStoreUrl('https://example.com/a.png', 'dinar', 'reports/x.md')).toBe('https://example.com/a.png')
    expect(resolveStoreUrl('#anchor', 'dinar', 'reports/x.md')).toBe('#anchor')
    expect(resolveStoreUrl('../secrets/key.txt', 'dinar', 'reports/x.md')).toBe('../secrets/key.txt')
  })
})
