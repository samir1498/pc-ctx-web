import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'

export interface FsListing {
  path: string
  parent: string | null
  dirs: string[]
  isContextStore: boolean
}

// node:fs is only ever imported from here — kept out of config-api.ts so that module
// stays safe to bundle for the Workers runtime, where this file is never reached.
export async function listDirectories(requestedPath?: string): Promise<FsListing> {
  const base = requestedPath?.trim() ? requestedPath : homedir()
  const resolved = resolve(base)
  const entries = await readdir(resolved, { withFileTypes: true })
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
  const parentPath = dirname(resolved)
  return { path: resolved, parent: parentPath === resolved ? null : parentPath, dirs, isContextStore: dirs.includes('plans') }
}
