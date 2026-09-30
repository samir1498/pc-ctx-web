import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KVLike } from '../store'
import { createStore } from '../store'

// Shaped like GitHub's GraphQL answers: tree aliases t<i>, blob aliases b<i>.
const PLAN = (n: number, status: string) => `---\ntitle: 'Plan ${n}'\nstatus: '${status}'\ntasks:\n  - id: 'T1'\n    desc: 'one'\n    status: 'done'\n  - id: 'T2'\n    desc: 'two'\n    status: 'pending'\n---\n# Plan ${n}\n\nWhy it matters.\n`
const PLANS = Array.from({ length: 45 }, (_, i) => ({ name: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}-plan-${i}.md`, oid: `oid${i}`, text: PLAN(i, i % 3 ? 'active' : 'done') }))
const STANDUPS = [{ name: '2026-09-29.md', oid: 'sd1', text: '# Standup\n\nShipped it.\n' }]
const BLOBS = new Map([...PLANS, ...STANDUPS].map((b) => [b.oid, b.text]))

function treeFor(expr: string) {
  if (expr.endsWith(':plans')) return { oid: 'tree-plans', entries: [{ name: 'README.md', type: 'blob', oid: 'r' }, ...PLANS.map((p) => ({ name: p.name, type: 'blob', oid: p.oid }))] }
  if (expr.endsWith(':progress/standup')) return { oid: 'tree-sd', entries: STANDUPS.map((s) => ({ name: s.name, type: 'blob', oid: s.oid })) }
  return null
}

let calls: { kind: 'tree' | 'blob'; aliases: number }[] = []

function fakeFetch(_url: string, init?: { body?: string }): Promise<Response> {
  const { query } = JSON.parse(init?.body ?? '{}') as { query: string }
  const repository: Record<string, unknown> = {}
  const trees = [...query.matchAll(/(t\d+): object\(expression: "([^"]+)"\)/g)]
  const blobs = [...query.matchAll(/(b\d+): object\(oid: "([^"]+)"\)/g)]
  for (const [, alias, expr] of trees) repository[alias!] = treeFor(expr!)
  for (const [, alias, oid] of blobs) repository[alias!] = { text: BLOBS.get(oid!) ?? null, isBinary: false, isTruncated: false }
  calls.push({ kind: trees.length ? 'tree' : 'blob', aliases: trees.length || blobs.length })
  return Promise.resolve(new Response(JSON.stringify({ data: { repository } })))
}

function memoryKv(): KVLike & { size: () => number } {
  const m = new Map<string, string>()
  return {
    get: async (k) => (m.has(k) ? JSON.parse(m.get(k)!) : null),
    put: async (k, v) => void m.set(k, v),
    size: () => m.size,
  }
}

const REF = { token: 't', owner: 'o', repo: 'r', branch: 'main', folder: '' }

describe('store over GitHub with a KV cache', () => {
  beforeEach(() => {
    calls = []
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads every folder tree in one GitHub call', async () => {
    const meter = { github: 0 }
    const s = createStore(REF, memoryKv(), 'p', meter)
    const t = await s.trees()
    expect(meter.github).toBe(1)
    expect(t.plans?.entries).toHaveLength(45)
    // README is the folder's description, not a document
    expect(t.plans?.entries.some((e) => e.name === 'README.md')).toBe(false)
  })

  it('page 1 of a folder costs one tree call and one 20-blob call, the second visit none', async () => {
    const kv = memoryKv()
    const meter = { github: 0 }
    const page = await createStore(REF, kv, 'p', meter).page('plans', 0, 20)
    expect(page.total).toBe(45)
    expect(page.items).toHaveLength(20)
    expect(calls).toEqual([{ kind: 'tree', aliases: expect.any(Number) }, { kind: 'blob', aliases: 20 }])
    expect(page.items[0]).toMatchObject({ title: expect.stringMatching(/^Plan /), progress: { done: 1, total: 2 } })

    const again = { github: 0 }
    await createStore(REF, kv, 'p', again).page('plans', 0, 20)
    expect(again.github).toBe(0)
  })

  it('a folder status chart reuses the per-blob cache and then one folder key', async () => {
    const kv = memoryKv()
    await createStore(REF, kv, 'p', { github: 0 }).page('plans', 0, 20)
    calls = []
    const metas = await createStore(REF, kv, 'p', { github: 0 }).allMetas('plans')
    expect(metas).toHaveLength(45)
    // only the 25 not already seen by page 1 are fetched
    expect(calls.filter((c) => c.kind === 'blob').reduce((n, c) => n + c.aliases, 0)).toBe(25)
    expect(metas.filter((m) => m.status === 'done')).toHaveLength(15)

    const meter = { github: 0 }
    await createStore(REF, kv, 'p', meter).allMetas('plans')
    expect(meter.github).toBe(0)
  })

  it('finds standups under progress/standup when the store has no standups folder', async () => {
    const s = createStore(REF, null, 'p', { github: 0 })
    const doc = await s.doc('standups', '2026-09-29')
    expect(doc?.path).toBe('progress/standup/2026-09-29.md')
    expect(doc?.body).toContain('Shipped it.')
  })

  it('serves the page when every KV write fails', async () => {
    const kv = { ...memoryKv(), put: () => Promise.reject(new Error('429 Too Many Requests')) }
    const page = await createStore(REF, kv, 'p', { github: 0 }).page('plans', 0, 5)
    expect(page.items).toHaveLength(5)
  })

  it('a renamed file keeps its content cache but shows its new slug and path', async () => {
    const kv = memoryKv()
    await createStore(REF, kv, 'p', { github: 0 }).allMetas('plans')
    const old = PLANS[0]!.name
    PLANS[0]!.name = '2026-09-01-renamed.md'
    try {
      // another project id skips the cached tree; meta keys are shared across projects
      const page = await createStore(REF, kv, 'p2', { github: 0 }).page('plans', 0, 45)
      const row = page.items.find((m) => m.oid === 'oid0')
      expect(row).toMatchObject({ slug: '2026-09-01-renamed', path: 'plans/2026-09-01-renamed.md' })
    } finally {
      PLANS[0]!.name = old
    }
  })

  it('answers null for a document that is not in the tree', async () => {
    const s = createStore(REF, null, 'p', { github: 0 })
    expect(await s.doc('plans', 'nope')).toBeNull()
  })
})
