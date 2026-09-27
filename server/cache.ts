import type { ContextSource, FolderEntry, FolderKey, ListEntry } from './source.js'
import { isRecord } from './source.js'

// Minimal shape of the Cloudflare KV binding — matches KVNamespace.get/put closely
// enough that a real binding satisfies this interface without a cast.
export interface KVLike {
  get(key: string, type: 'json'): Promise<unknown>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export interface CacheOptions {
  projectId: string
  ttlSeconds?: number
}

function isListEntry(value: unknown): value is ListEntry {
  return isRecord(value) && typeof value.slug === 'string' && typeof value.name === 'string' && typeof value.path === 'string'
}

function isListEntryArray(value: unknown): value is ListEntry[] {
  return Array.isArray(value) && value.every(isListEntry)
}

function isFolderEntry(value: unknown): value is FolderEntry {
  return isRecord(value) && typeof value.slug === 'string' && typeof value.name === 'string' && typeof value.path === 'string'
}

function isFolderEntryArray(value: unknown): value is FolderEntry[] {
  return Array.isArray(value) && value.every(isFolderEntry)
}

// list() can legitimately resolve to null (folder absent upstream); an envelope lets us
// tell "cached null" apart from "cache miss" (KV.get also returns null on a miss).
function readEnvelope(cached: unknown): unknown {
  if (!isRecord(cached) || !('v' in cached)) return undefined
  return cached.v
}

export function cachedSource(source: ContextSource, kv: KVLike, options: CacheOptions): ContextSource {
  const ttl = options.ttlSeconds ?? 300
  const listKey = (folder: FolderKey): string => `ctx:${options.projectId}:list:${folder}`
  const readKey = (folder: FolderKey, names: string[]): string =>
    `ctx:${options.projectId}:read:${folder}:${[...names].sort().join(',')}`

  return {
    async list(folder: FolderKey): Promise<ListEntry[] | null> {
      const key = listKey(folder)
      const cached = await kv.get(key, 'json')
      const value = readEnvelope(cached)
      if (value === null) return null
      if (isListEntryArray(value)) return value

      const result = await source.list(folder)
      await kv.put(key, JSON.stringify({ v: result }), { expirationTtl: ttl })
      return result
    },

    async read(folder: FolderKey, names: string[]): Promise<FolderEntry[]> {
      if (names.length === 0) return []
      const key = readKey(folder, names)
      const cached = await kv.get(key, 'json')
      if (isFolderEntryArray(cached)) return cached

      const result = await source.read(folder, names)
      await kv.put(key, JSON.stringify(result), { expirationTtl: ttl })
      return result
    },
  }
}
