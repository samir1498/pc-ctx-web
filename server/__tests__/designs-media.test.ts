import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApi } from '../api.js'
import { diskSource } from '../disk.js'
import { FOLDERS, MEDIA_PATH_RE, htmlMeta, isDocument, mediaContentType, withFolderFallbacks } from '../source.js'

const LOGO_HTML = `<style>.page{max-width:640px}</style>
<div class="page">
<p class="eyebrow">Dinar &middot; design</p>
<h1>Dinar's logo</h1>
<p class="lede">One mark serves both scripts.</p>
<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>
<img src="../media/screens/till.webp" alt="till">
</div>`

// A 1x1 PNG, enough to be served and checked byte for byte.
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137])

describe('designs: a folder that may hold HTML pages', () => {
  it('is one of the store folders and accepts .html there only', () => {
    expect(FOLDERS).toContain('designs')
    expect(isDocument('e-logo.html', 'designs')).toBe(true)
    expect(isDocument('account-360.html', 'mockups')).toBe(true)
    expect(isDocument('note.html', 'reports')).toBe(false)
    expect(isDocument('screens.md', 'designs')).toBe(true)
    expect(isDocument('README.md', 'designs')).toBe(false)
  })

  it('reads a kept-HTML page’s title and lede as its front matter', () => {
    expect(htmlMeta(LOGO_HTML)).toEqual({ kind: 'html', title: "Dinar's logo", tldr: 'One mark serves both scripts.' })
    expect(htmlMeta('<html><head><title>Account 360</title></head><body><p>x</p></body></html>')).toEqual({ kind: 'html', title: 'Account 360' })
  })

  it('only serves plain relative picture paths under media/', () => {
    expect(MEDIA_PATH_RE.test('screens/till.webp')).toBe(true)
    expect(MEDIA_PATH_RE.test('reports/2026-09-24-till.png')).toBe(true)
    expect(MEDIA_PATH_RE.test('../plans/secret.md')).toBe(false)
    expect(MEDIA_PATH_RE.test('/etc/passwd')).toBe(false)
    expect(MEDIA_PATH_RE.test('a/b.txt')).toBe(false)
    expect(mediaContentType('x.webp')).toBe('image/webp')
    expect(mediaContentType('x.PNG')).toBe('image/png')
  })
})

describe('a store with designs and media on disk', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc-ctx-web-designs-'))
    await mkdir(join(root, 'designs'), { recursive: true })
    await mkdir(join(root, 'media', 'screens'), { recursive: true })
    await writeFile(join(root, 'designs', 'e-logo.html'), LOGO_HTML)
    await writeFile(join(root, 'designs', 'screens.md'), "---\ntitle: 'Screens'\n---\n\n![Till](../media/screens/till.png \"The till\")\n")
    await writeFile(join(root, 'media', 'screens', 'till.png'), PNG)
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  const api = () => createApi({ projects: [{ id: 'fx', name: 'Fixture', sourceKind: 'disk' }], sourceFor: () => diskSource(root) })

  it('lists the HTML page next to the markdown one, with a title', async () => {
    const res = await api().request('/api/p/fx/designs?meta=1')
    expect(res.status).toBe(200)
    const items = (await res.json()) as { slug: string; frontmatter: { title?: string; kind?: string } }[]
    expect(items.map((i) => i.slug).sort()).toEqual(['e-logo', 'screens'])
    const logo = items.find((i) => i.slug === 'e-logo')
    expect(logo?.frontmatter).toEqual({ kind: 'html', title: "Dinar's logo", tldr: 'One mark serves both scripts.' })
    const counts = (await (await api().request('/api/p/fx/counts')).json()) as Record<string, number>
    expect(counts.designs).toBe(2)
  })

  it('serves the page body raw and the picture with its type, cacheable', async () => {
    const page = (await (await api().request('/api/p/fx/designs/e-logo')).json()) as { body: string }
    expect(page.body).toContain('<svg')
    const res = await api().request('/api/p/fx/media/screens/till.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toContain('max-age=3600')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG)
  })

  it('refuses paths that leave media/ or name another kind of file', async () => {
    expect((await api().request('/api/p/fx/media/../designs/e-logo.html')).status).toBe(404)
    expect((await api().request('/api/p/fx/media/%2e%2e/designs/e-logo.html')).status).toBe(404)
    expect((await api().request('/api/p/fx/media/screens/missing.png')).status).toBe(404)
    expect((await api().request('/api/p/fx/media/screens/till.txt')).status).toBe(404)
  })

  it('falls back to a mockups/ folder when a store has no designs/', async () => {
    const other = await mkdtemp(join(tmpdir(), 'pc-ctx-web-mockups-'))
    await mkdir(join(other, 'mockups'), { recursive: true })
    await writeFile(join(other, 'mockups', 'account-360.html'), '<h1>Account 360</h1>')
    const source = withFolderFallbacks(diskSource(other))
    expect((await source.list('designs'))?.map((e) => e.slug)).toEqual(['account-360'])
    expect((await source.read('designs', ['account-360.html']))[0]?.frontmatter?.title).toBe('Account 360')
    await rm(other, { recursive: true, force: true })
  })
})
