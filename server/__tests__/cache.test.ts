import { describe, expect, it } from 'vitest'
import { cachedSource } from '../cache.js'
import type { KVLike } from '../cache.js'
import type { ContextSource, FolderEntry, FolderKey, ListEntry } from '../source.js'

function fakeKv(): KVLike & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    async get(key, type) {
      if (type !== 'json') return null
      const raw = store.get(key)
      return raw === undefined ? null : JSON.parse(raw)
    },
    async put(key, value) {
      store.set(key, value)
    },
  }
}

function countingSource(underlying: ContextSource): { source: ContextSource; calls: { list: number; read: number } } {
  const calls = { list: 0, read: 0 }
  const source: ContextSource = {
    async list(folder: FolderKey): Promise<ListEntry[] | null> {
      calls.list++
      return underlying.list(folder)
    },
    async read(folder: FolderKey, names: string[]): Promise<FolderEntry[]> {
      calls.read++
      return underlying.read(folder, names)
    },
  }
  return { source, calls }
}

const entryA: ListEntry = { slug: 'a', name: 'a.md', path: 'plans/a.md' }
const entryB: ListEntry = { slug: 'b', name: 'b.md', path: 'plans/b.md' }
const fileA: FolderEntry = { slug: 'a', name: 'a.md', path: 'plans/a.md', body: 'A' }
const fileB: FolderEntry = { slug: 'b', name: 'b.md', path: 'plans/b.md', body: 'B' }

const backing: ContextSource = {
  async list(folder) {
    if (folder === 'roadmaps') return null
    return [entryA, entryB]
  },
  async read(folder, names) {
    return [fileA, fileB].filter((f) => names.includes(f.name))
  },
}

describe('cachedSource', () => {
  it('caches a list() hit so the underlying source is only called once', async () => {
    const { source, calls } = countingSource(backing)
    const cached = cachedSource(source, fakeKv(), { projectId: 'proj' })
    await cached.list('plans')
    await cached.list('plans')
    expect(calls.list).toBe(1)
  })

  it('caches an explicit null result (folder absent) without re-fetching', async () => {
    const { source, calls } = countingSource(backing)
    const cached = cachedSource(source, fakeKv(), { projectId: 'proj' })
    expect(await cached.list('roadmaps')).toBeNull()
    expect(await cached.list('roadmaps')).toBeNull()
    expect(calls.list).toBe(1)
  })

  it('caches read() by a name-order-independent key', async () => {
    const { source, calls } = countingSource(backing)
    const cached = cachedSource(source, fakeKv(), { projectId: 'proj' })
    await cached.read('plans', ['a.md', 'b.md'])
    await cached.read('plans', ['b.md', 'a.md'])
    expect(calls.read).toBe(1)
  })

  it('keys the cache by projectId so two projects never share a cache entry', async () => {
    const { source, calls } = countingSource(backing)
    const kv = fakeKv()
    const cachedOne = cachedSource(source, kv, { projectId: 'one' })
    const cachedTwo = cachedSource(source, kv, { projectId: 'two' })
    await cachedOne.list('plans')
    await cachedTwo.list('plans')
    expect(calls.list).toBe(2)
  })

  it('hashes read() keys past the KV 512-byte limit and still round-trips', async () => {
    const kv = fakeKv()
    let reads = 0
    const names = Array.from({ length: 120 }, (_, i) => `20260928-long-plan-name-number-${i}-padded-to-be-realistic.md`)
    const big: ContextSource = {
      async list() { return [] },
      async read(_f, ns) { reads++; return ns.map((name) => ({ slug: name, name, path: `plans/${name}`, body: 'x' })) },
    }
    const cachedBig = cachedSource(big, kv, { projectId: 'proj' })
    expect(await cachedBig.read('plans', names)).toHaveLength(120)
    for (const key of kv.store.keys()) expect(key.length).toBeLessThanOrEqual(512)
    await cachedBig.read('plans', [...names].reverse())
    expect(reads).toBe(1)
  })
})
