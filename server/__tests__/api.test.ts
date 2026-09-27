import { describe, expect, it } from 'vitest'
import { createApi } from '../api.js'
import type { ProjectInfo } from '../api.js'
import type { ContextSource, FolderEntry, FolderKey, ListEntry } from '../source.js'
import { toEntry, toListEntry } from '../source.js'

function memorySource(files: Partial<Record<FolderKey, string[]>>): ContextSource {
  const raw = new Map<string, string>()
  for (const [folder, names] of Object.entries(files)) {
    for (const name of names ?? []) {
      raw.set(`${folder}:${name}`, `---\ntitle: ${name}\n---\n\nBody of ${name}`)
    }
  }
  return {
    async list(folder: FolderKey): Promise<ListEntry[] | null> {
      const names = files[folder]
      if (!names) return null
      return names.map((name) => toListEntry(folder, name))
    },
    async read(folder: FolderKey, names: string[]): Promise<FolderEntry[]> {
      const out: FolderEntry[] = []
      for (const name of names) {
        const text = raw.get(`${folder}:${name}`)
        if (text) out.push(toEntry(folder, name, text))
      }
      return out
    },
  }
}

function throwingSource(message: string): ContextSource {
  return {
    async list() {
      throw new Error(message)
    },
    async read() {
      throw new Error(message)
    },
  }
}

const alphaFiles: Partial<Record<FolderKey, string[]>> = {
  plans: ['2024-01-01-one.md', '2024-01-02-two.md', 'zzz-three.md'],
  'plans-archived': ['2023-01-01-old.md'],
}

describe('createApi', () => {
  function buildApp() {
    interface ProjectWithToken extends ProjectInfo {
      token?: string
    }
    const projects: ProjectWithToken[] = [
      { id: 'alpha', name: 'Alpha', sourceKind: 'github', token: 'sek-should-not-leak' },
      { id: 'beta', name: 'Beta', sourceKind: 'disk' },
      { id: 'broken', name: 'Broken', sourceKind: 'disk' },
    ]
    const sources = new Map<string, ContextSource>([
      ['alpha', memorySource(alphaFiles)],
      ['beta', memorySource({ plans: ['b.md'] })],
      ['broken', throwingSource('boom')],
    ])
    return createApi({ projects, sourceFor: (id) => sources.get(id) ?? null })
  }

  it('lists projects with id, name and sourceKind, and never a token', async () => {
    const app = buildApp()
    const res = await app.request('/api/projects')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(JSON.stringify(body)).not.toContain('sek-should-not-leak')
    expect(body).toEqual([
      { id: 'alpha', name: 'Alpha', sourceKind: 'github' },
      { id: 'beta', name: 'Beta', sourceKind: 'disk' },
      { id: 'broken', name: 'Broken', sourceKind: 'disk' },
    ])
  })

  it('serves a project folder, including the plans-archived key', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/alpha/plans-archived')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(Array.isArray(body)).toBe(true)
    if (Array.isArray(body)) expect(body).toHaveLength(1)
  })

  it('paginates a folder with page/size and reports total', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/alpha/plans?page=0&size=2')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ total: 3, page: 0, size: 2 })
  })

  it('maps legacy /api/:folder to the first project', async () => {
    const app = buildApp()
    const legacy = await app.request('/api/plans?list=1')
    const direct = await app.request('/api/p/alpha/plans?list=1')
    expect(await legacy.json()).toEqual(await direct.json())
  })

  it('maps legacy /api/:folder/:slug to the first project', async () => {
    const app = buildApp()
    const legacy = await app.request('/api/plans/2024-01-01-one')
    const direct = await app.request('/api/p/alpha/plans/2024-01-01-one')
    expect(legacy.status).toBe(200)
    expect(await legacy.json()).toEqual(await direct.json())
  })

  it('maps legacy /api/counts to the first project', async () => {
    const app = buildApp()
    const legacy = await app.request('/api/counts')
    const direct = await app.request('/api/p/alpha/counts')
    expect(legacy.status).toBe(200)
    expect(await legacy.json()).toEqual(await direct.json())
  })

  it('reports per-folder counts for a project', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/alpha/counts')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ plans: 3, roadmaps: 0 })
  })

  it('strips body when meta=1 is set', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/alpha/plans?meta=1')
    const body: unknown = await res.json()
    expect(Array.isArray(body)).toBe(true)
    if (Array.isArray(body)) {
      for (const item of body) expect(item).not.toHaveProperty('body')
    }
  })

  it('404s for an unknown project', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/nope/plans')
    expect(res.status).toBe(404)
  })

  it('404s for an unknown folder', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/alpha/not-a-folder')
    expect(res.status).toBe(404)
  })

  it('404s for an unknown slug', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/alpha/plans/does-not-exist')
    expect(res.status).toBe(404)
  })

  it('502s with a message when the source throws', async () => {
    const app = buildApp()
    const res = await app.request('/api/p/broken/plans')
    expect(res.status).toBe(502)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ status: 502 })
    expect(JSON.stringify(body)).toContain('boom')
  })
})
