import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApi } from '../api.js'
import { diskSource } from '../disk.js'
import { FOLDERS, folderPath, isDocument, withFolderFallbacks } from '../source.js'

describe('folder layout', () => {
  it('knows the domains a store may carry, including loops and research', () => {
    expect(FOLDERS).toContain('loops')
    expect(FOLDERS).toContain('research')
    expect(folderPath('progress-standup')).toBe('progress/standup')
  })

  it('treats a README as the folder description, not a document', () => {
    expect(isDocument('README.md')).toBe(false)
    expect(isDocument('readme.mdx')).toBe(false)
    expect(isDocument('2026-09-22.md')).toBe(true)
    expect(isDocument('notes.txt')).toBe(false)
  })
})

// A fixture store shaped like the two real ones: no standups/ at the root,
// the daily notes under progress/standup/ next to that folder's README.
describe('withFolderFallbacks over a disk store', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc-ctx-web-fallback-'))
    await mkdir(join(root, 'progress', 'standup'), { recursive: true })
    await mkdir(join(root, 'plans'), { recursive: true })
    await writeFile(join(root, 'progress', 'standup', 'README.md'), '# Standup notes\n')
    await writeFile(join(root, 'progress', 'standup', '2026-09-22.md'), "---\ntype: 'daily'\n---\n\n# Standup, 22 September\n\n- Yesterday: shipped.\n")
    await writeFile(join(root, 'plans', '2026-09-01-alpha.md'), '---\ntitle: Alpha\nstatus: active\n---\n\nAlpha body.\n')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('lists standups from progress/standup when standups/ is absent, skipping the README', async () => {
    const source = withFolderFallbacks(diskSource(root))
    const entries = await source.list('standups')
    expect(entries?.map((e) => e.name)).toEqual(['2026-09-22.md'])
    expect(entries?.[0]?.path).toBe('progress/standup/2026-09-22.md')
  })

  it('reads a fallback standup by the name the listing gave', async () => {
    const source = withFolderFallbacks(diskSource(root))
    const [file] = await source.read('standups', ['2026-09-22.md'])
    expect(file?.slug).toBe('2026-09-22')
    expect(file?.body).toContain('Standup, 22 September')
  })

  it('still answers null for a folder that exists nowhere', async () => {
    const source = withFolderFallbacks(diskSource(root))
    expect(await source.list('reports')).toBeNull()
  })

  it('serves the fallback standup through the project API by slug', async () => {
    const app = createApi({
      projects: [{ id: 'fx', name: 'Fixture', sourceKind: 'disk' }],
      sourceFor: () => diskSource(root),
    })
    const list = await app.request('/api/p/fx/standups?list=1')
    expect(list.status).toBe(200)
    expect(await list.json()).toEqual([{ slug: '2026-09-22', name: '2026-09-22.md', path: 'progress/standup/2026-09-22.md' }])

    const one = await app.request('/api/p/fx/standups/2026-09-22')
    expect(one.status).toBe(200)
    const body: unknown = await one.json()
    expect(JSON.stringify(body)).toContain('Standup, 22 September')

    const counts = await app.request('/api/p/fx/counts')
    const c: unknown = await counts.json()
    expect(c).toMatchObject({ standups: 1, plans: 1, reports: 0, loops: 0 })
  })
})
