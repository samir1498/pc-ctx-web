import { describe, expect, it } from 'vitest'
import { kvConfigStore } from '../config-store.js'
import type { ConfigKVLike, ProjectConfig } from '../config-store.js'

function fakeKv(): ConfigKVLike & { store: Map<string, string> } {
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
    async delete(key) {
      store.delete(key)
    },
    async list({ prefix }) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }))
      return { keys }
    },
  }
}

describe('kvConfigStore', () => {
  it('round-trips projects and a token through a fake KV', async () => {
    const store = kvConfigStore(fakeKv())
    const projects: ProjectConfig[] = [
      { id: 'beta', name: 'Beta', source: 'github', owner: 'samir1498', repo: 'ctx', branch: 'main', folder: '' },
    ]
    await store.saveProjects(projects)
    await store.setToken('samir1498', 'ghp_test_should_never_leak')

    expect(await store.getProjects()).toEqual(projects)
    expect(await store.hasToken('samir1498')).toBe(true)
    expect(await store.getToken('samir1498')).toBe('ghp_test_should_never_leak')
    expect(await store.listTokenOwners()).toEqual(['samir1498'])
  })

  it('rejects a disk project at save', async () => {
    const store = kvConfigStore(fakeKv())
    const projects: ProjectConfig[] = [{ id: 'alpha', name: 'Alpha', source: 'disk', dir: '/tmp' }]
    await expect(store.saveProjects(projects)).rejects.toThrow(/disk/)
  })

  it('deleting a token removes it from both get and list', async () => {
    const store = kvConfigStore(fakeKv())
    await store.setToken('samir1498', 'ghp_test_should_never_leak')
    await store.deleteToken('samir1498')
    expect(await store.getToken('samir1498')).toBeNull()
    expect(await store.listTokenOwners()).toEqual([])
  })
})
