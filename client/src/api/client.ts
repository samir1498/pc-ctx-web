import type { ContextItem, ContextItemDetail, Folder } from '../types'

const BASE = '/api'

export async function fetchFolder(folder: Folder, meta = false): Promise<ContextItem[]> {
  const res = await fetch(`${BASE}/${folder}${meta ? '?meta=1' : ''}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`)
  return res.json()
}

export async function fetchItem(folder: Folder, slug: string): Promise<ContextItemDetail> {
  const res = await fetch(`${BASE}/${folder}/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`Failed to fetch ${folder}/${slug}: ${res.status}`)
  return res.json()
}

// One request for every folder's file count — no bodies fetched. Server support
// is additive; older servers 404 this path, so callers treat failure as "no
// counts" rather than an error.
export async function fetchCounts(): Promise<Partial<Record<Folder, number>>> {
  const res = await fetch(`${BASE}/counts`)
  if (!res.ok) throw new Error(`Failed to fetch counts: ${res.status}`)
  return res.json()
}
