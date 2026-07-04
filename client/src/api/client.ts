import type { ContextItem, ContextItemDetail, Folder, ListEntry, PagedResponse } from '../types'
import { mockFolders, mockPlansDetail, mockRoadmapsDetail } from './mock-data'

const BASE = '/api'

const IS_DEMO = typeof window !== 'undefined' &&
  (new URLSearchParams(window.location.search).get('demo') === 'true' ||
   import.meta.env.VITE_DEMO === 'true')

// Every slug in a folder, names only (no bodies) — cheap enough to search the
// whole folder client-side. Fetched lazily, only when the user starts a search.
export async function fetchFolderList(folder: Folder): Promise<ListEntry[]> {
  if (IS_DEMO) {
    const items = mockFolders[folder]
    if (!items) return []
    return items.map(({ slug, name, path }) => ({ slug, name, path }))
  }
  const res = await fetch(`${BASE}/${folder}?list=1`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to list ${folder}: ${res.status}`)
  return res.json()
}

export async function fetchFolder(folder: Folder, meta = false): Promise<ContextItem[]> {
  if (IS_DEMO) {
    const items = mockFolders[folder]
    if (!items) return []
    return items
  }
  const res = await fetch(`${BASE}/${folder}${meta ? '?meta=1' : ''}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`)
  return res.json()
}

// One page of a folder. The server lists filenames cheaply, then fetches only
// this page's bodies — so large folders stay fast. meta=true drops bodies.
export async function fetchFolderPage(
  folder: Folder,
  page: number,
  size: number,
  meta = true,
): Promise<PagedResponse> {
  if (IS_DEMO) {
    const items = mockFolders[folder]
    if (!items) return { total: 0, page, size, items: [] }
    const slice = items.slice(page * size, page * size + size)
    return { total: items.length, page, size, items: slice }
  }
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (meta) params.set('meta', '1')
  const res = await fetch(`${BASE}/${folder}?${params}`)
  if (res.status === 404) return { total: 0, page, size, items: [] }
  if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`)
  return res.json()
}

export async function fetchItem(folder: Folder, slug: string): Promise<ContextItemDetail> {
  if (IS_DEMO) {
    // Check plans detail first
    if (folder === 'plans' && mockPlansDetail[slug]) {
      return mockPlansDetail[slug]
    }
    // Check roadmaps detail
    if (folder === 'roadmaps' && mockRoadmapsDetail[slug]) {
      return mockRoadmapsDetail[slug]
    }
    // Fallback: return the list item with body
    const items = mockFolders[folder]
    const item = items?.find(i => i.slug === slug)
    if (item) {
      return {
        ...item,
        frontmatter: item.frontmatter || {},
        body: item.body || '',
      }
    }
    throw new Error(`Mock: ${folder}/${slug} not found`)
  }

  const res = await fetch(`${BASE}/${folder}/${encodeURIComponent(slug)}`)
  if (!res.ok) throw new Error(`Failed to fetch ${folder}/${slug}: ${res.status}`)
  return res.json()
}

// One request for every folder's file count — no bodies fetched. Server support
// is additive; older servers 404 this path, so callers treat failure as "no
// counts" rather than an error.
export async function fetchCounts(): Promise<Partial<Record<Folder, number>>> {
  if (IS_DEMO) {
    const counts: Partial<Record<Folder, number>> = {}
    for (const [folder, items] of Object.entries(mockFolders)) {
      counts[folder as Folder] = items.length
    }
    return counts
  }
  const res = await fetch(`${BASE}/counts`)
  if (!res.ok) throw new Error(`Failed to fetch counts: ${res.status}`)
  return res.json()
}
