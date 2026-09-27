import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ConfigStore, ProjectConfig } from './config-store.js'
import { isProjectConfig } from './config-store.js'
import { isRecord } from './source.js'

interface HubConfigFile {
  projects: ProjectConfig[]
  tokens?: Record<string, string>
}

function isHubConfigFile(v: unknown): v is HubConfigFile {
  if (!isRecord(v) || !Array.isArray(v.projects) || !v.projects.every(isProjectConfig)) return false
  if (v.tokens !== undefined) {
    if (!isRecord(v.tokens)) return false
    if (!Object.values(v.tokens).every((t) => typeof t === 'string')) return false
  }
  return true
}

function isEnoent(err: unknown): boolean {
  return isRecord(err) && err.code === 'ENOENT'
}

async function readConfig(path: string): Promise<HubConfigFile> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if (isEnoent(err)) return { projects: [] }
    throw err
  }
  const parsed: unknown = JSON.parse(raw)
  if (!isHubConfigFile(parsed)) throw new Error(`Invalid hub config at ${path}`)
  return parsed
}

// tmp + rename keeps a crash or concurrent read from ever seeing a half-written file;
// mode 0600 is set explicitly since writeFile's mode option is still subject to umask.
async function writeConfig(path: string, config: HubConfigFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, JSON.stringify(config, null, 2), { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, path)
}

export function fileConfigStore(path: string): ConfigStore {
  return {
    async getProjects(): Promise<ProjectConfig[]> {
      const config = await readConfig(path)
      return config.projects
    },
    async saveProjects(projects: ProjectConfig[]): Promise<void> {
      const config = await readConfig(path)
      await writeConfig(path, { ...config, projects })
    },
    async hasToken(owner: string): Promise<boolean> {
      const config = await readConfig(path)
      const token = config.tokens?.[owner]
      return typeof token === 'string' && token.length > 0
    },
    async getToken(owner: string): Promise<string | null> {
      const config = await readConfig(path)
      return config.tokens?.[owner] ?? null
    },
    async setToken(owner: string, token: string): Promise<void> {
      const config = await readConfig(path)
      const tokens = { ...(config.tokens ?? {}), [owner]: token }
      await writeConfig(path, { ...config, tokens })
    },
    async deleteToken(owner: string): Promise<void> {
      const config = await readConfig(path)
      const tokens = { ...(config.tokens ?? {}) }
      delete tokens[owner]
      await writeConfig(path, { ...config, tokens })
    },
    async listTokenOwners(): Promise<string[]> {
      const config = await readConfig(path)
      return Object.keys(config.tokens ?? {})
    },
  }
}
