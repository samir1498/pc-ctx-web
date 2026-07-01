import type { ContextItem, ContextItemDetail, Folder } from '../types'

const BASE = '/api'

export async function fetchFolder(folder: Folder): Promise<ContextItem[]> {
  const res = await fetch(`${BASE}/${folder}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`)
  return res.json()
}

export async function fetchItem(folder: Folder, slug: string): Promise<ContextItemDetail> {
  const res = await fetch(`${BASE}/${folder}/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`Failed to fetch ${folder}/${slug}: ${res.status}`)
  return res.json()
}
