import { readFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileConfigStore } from '../file-config-store.js'
import type { ProjectConfig } from '../config-store.js'

describe('fileConfigStore', () => {
  let root: string
  let configPath: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc-ctx-web-file-store-'))
    configPath = join(root, 'pc-ctx', 'hub.json')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('starts with no projects when the file does not exist yet', async () => {
    const store = fileConfigStore(configPath)
    expect(await store.getProjects()).toEqual([])
  })

  it('round-trips projects and tokens through save and read', async () => {
    const store = fileConfigStore(configPath)
    const projects: ProjectConfig[] = [
      { id: 'alpha', name: 'Alpha', source: 'disk', dir: '/home/user/alpha' },
      { id: 'beta', name: 'Beta', source: 'github', owner: 'samir1498', repo: 'ctx', branch: 'main', folder: '' },
    ]
    await store.saveProjects(projects)
    await store.setToken('samir1498', 'ghp_test_should_never_leak')

    const reopened = fileConfigStore(configPath)
    expect(await reopened.getProjects()).toEqual(projects)
    expect(await reopened.hasToken('samir1498')).toBe(true)
    expect(await reopened.getToken('samir1498')).toBe('ghp_test_should_never_leak')
    expect(await reopened.listTokenOwners()).toEqual(['samir1498'])
  })

  it('deletes a token without touching the projects list', async () => {
    const store = fileConfigStore(configPath)
    await store.saveProjects([{ id: 'alpha', name: 'Alpha', source: 'disk', dir: '/tmp' }])
    await store.setToken('samir1498', 'ghp_test_should_never_leak')
    await store.deleteToken('samir1498')
    expect(await store.hasToken('samir1498')).toBe(false)
    expect(await store.getToken('samir1498')).toBeNull()
    expect(await store.getProjects()).toHaveLength(1)
  })

  it('writes the config file with mode 0600', async () => {
    const store = fileConfigStore(configPath)
    await store.setToken('samir1498', 'ghp_test_should_never_leak')
    const info = await stat(configPath)
    expect(info.mode & 0o777).toBe(0o600)
  })

  it('never leaves a partially written file behind (tmp file is renamed away)', async () => {
    const store = fileConfigStore(configPath)
    await store.saveProjects([{ id: 'alpha', name: 'Alpha', source: 'disk', dir: '/tmp' }])
    const raw = await readFile(configPath, 'utf-8')
    expect(() => JSON.parse(raw)).not.toThrow()
  })
})
