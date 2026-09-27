import { isRecord } from './source.js'

export interface DiskProjectConfig {
  id: string
  name: string
  source: 'disk'
  dir: string
}

export interface GithubProjectConfig {
  id: string
  name: string
  source: 'github'
  owner: string
  repo: string
  branch: string
  folder: string
}

export type ProjectConfig = DiskProjectConfig | GithubProjectConfig

export function isDiskProjectConfig(v: unknown): v is DiskProjectConfig {
  return isRecord(v) && v.source === 'disk' && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.dir === 'string'
}

export function isGithubProjectConfig(v: unknown): v is GithubProjectConfig {
  return (
    isRecord(v) &&
    v.source === 'github' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.owner === 'string' &&
    typeof v.repo === 'string' &&
    typeof v.branch === 'string' &&
    typeof v.folder === 'string'
  )
}

export function isProjectConfig(v: unknown): v is ProjectConfig {
  return isDiskProjectConfig(v) || isGithubProjectConfig(v)
}

export interface ConfigStore {
  getProjects(): Promise<ProjectConfig[]>
  saveProjects(projects: ProjectConfig[]): Promise<void>
  hasToken(owner: string): Promise<boolean>
  setToken(owner: string, token: string): Promise<void>
  deleteToken(owner: string): Promise<void>
  getToken(owner: string): Promise<string | null>
  // Not in the original brief: needed so GET /api/config can report a token stored
  // for an owner whose project was since removed, not only owners in the current list.
  listTokenOwners(): Promise<string[]>
}

// Minimal shape of the Cloudflare KV binding this store needs — matches KVNamespace
// closely enough that a real binding satisfies it without a cast (same pattern as cache.ts).
export interface ConfigKVLike {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(options: { prefix: string }): Promise<{ keys: { name: string }[] }>
}

const PROJECTS_KEY = 'config:projects'
const TOKEN_PREFIX = 'token:'
const tokenKey = (owner: string): string => `${TOKEN_PREFIX}${owner}`

function isProjectConfigArray(v: unknown): ProjectConfig[] | null {
  if (!Array.isArray(v)) return null
  const out: ProjectConfig[] = []
  for (const item of v) {
    if (!isProjectConfig(item)) return null
    out.push(item)
  }
  return out
}

// Deployed (Pages Function + KV) side of ConfigStore. Disk projects have nowhere to
// resolve a directory on the edge, so saveProjects refuses them regardless of caller.
export function kvConfigStore(kv: ConfigKVLike): ConfigStore {
  return {
    async getProjects(): Promise<ProjectConfig[]> {
      const raw = await kv.get(PROJECTS_KEY, 'json')
      return isProjectConfigArray(raw) ?? []
    },
    async saveProjects(projects: ProjectConfig[]): Promise<void> {
      if (projects.some((p) => p.source === 'disk')) {
        throw new Error('disk projects are not supported in deployed mode')
      }
      await kv.put(PROJECTS_KEY, JSON.stringify(projects))
    },
    async hasToken(owner: string): Promise<boolean> {
      const raw = await kv.get(tokenKey(owner), 'json')
      return typeof raw === 'string' && raw.length > 0
    },
    async getToken(owner: string): Promise<string | null> {
      const raw = await kv.get(tokenKey(owner), 'json')
      return typeof raw === 'string' ? raw : null
    },
    async setToken(owner: string, token: string): Promise<void> {
      await kv.put(tokenKey(owner), JSON.stringify(token))
    },
    async deleteToken(owner: string): Promise<void> {
      await kv.delete(tokenKey(owner))
    },
    async listTokenOwners(): Promise<string[]> {
      const { keys } = await kv.list({ prefix: TOKEN_PREFIX })
      return keys.map((k) => k.name.slice(TOKEN_PREFIX.length))
    },
  }
}
