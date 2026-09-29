import type {
  ContextItem,
  ContextItemDetail,
  Folder,
  FsListing,
  GithubRepoSummary,
  HubConfig,
  ListEntry,
  PagedResponse,
  ProjectConfigEntry,
  ProjectFolder,
  ProjectSummary,
} from '../types'
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

// ---- multi-project hub (layout B: /p/$project) ----
// Demo mode has no server behind it, so every project-scoped call degrades to
// an empty result rather than a fetch error; a single fake project keeps the
// tab bar and the "/" redirect working.

export async function fetchProjects(): Promise<ProjectSummary[]> {
  if (IS_DEMO) return [{ id: 'demo', name: 'Demo', sourceKind: 'disk', audience: 'engineering' }]
  const res = await fetch(`${BASE}/projects`)
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`)
  return res.json()
}

const projBase = (project: string): string => `${BASE}/p/${encodeURIComponent(project)}`

export async function fetchProjectFolderList(project: string, folder: ProjectFolder): Promise<ListEntry[]> {
  if (IS_DEMO) return []
  const res = await fetch(`${projBase(project)}/${folder}?list=1`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to list ${folder}: ${res.status}`)
  return res.json()
}

export async function fetchProjectFolder(project: string, folder: ProjectFolder, meta = false): Promise<ContextItem[]> {
  if (IS_DEMO) return []
  const res = await fetch(`${projBase(project)}/${folder}${meta ? '?meta=1' : ''}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`)
  return res.json()
}

// One page of a project folder, frontmatter only: a big folder (an archive of
// hundreds of pages) lists without fetching every body.
export async function fetchProjectFolderPage(project: string, folder: ProjectFolder, page: number, size: number): Promise<PagedResponse> {
  if (IS_DEMO) return { total: 0, page, size, items: [] }
  const params = new URLSearchParams({ page: String(page), size: String(size), meta: '1' })
  const res = await fetch(`${projBase(project)}/${folder}?${params}`)
  if (res.status === 404) return { total: 0, page, size, items: [] }
  if (!res.ok) throw new Error(`Failed to fetch ${folder}: ${res.status}`)
  return res.json()
}

export async function fetchProjectItem(project: string, folder: ProjectFolder, slug: string): Promise<ContextItemDetail | null> {
  if (IS_DEMO) return null
  const res = await fetch(`${projBase(project)}/${folder}/${encodeURIComponent(slug)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to fetch ${folder}/${slug}: ${res.status}`)
  return res.json()
}

export async function fetchProjectCounts(project: string): Promise<Partial<Record<Folder, number>>> {
  if (IS_DEMO) return {}
  const res = await fetch(`${projBase(project)}/counts`)
  if (!res.ok) throw new Error(`Failed to fetch counts: ${res.status}`)
  return res.json()
}

// ---- settings (/api/config/*) ----
// Demo mode has no local/deployed server behind it; reads degrade to an empty
// config and mutations no-op, so the Settings page renders without a fetch error.

const emptyConfig: HubConfig = { mode: 'local', projects: [], tokens: {} }
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function fetchConfig(): Promise<HubConfig> {
  if (IS_DEMO) return emptyConfig
  const res = await fetch(`${BASE}/config`)
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`)
  return res.json()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export async function saveProjectConfigs(projects: ProjectConfigEntry[]): Promise<ProjectConfigEntry[]> {
  if (IS_DEMO) return projects
  const res = await fetch(`${BASE}/config/projects`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(projects) })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    const message = isRecord(body) && typeof body.error === 'string' ? body.error : res.statusText
    throw new Error(message)
  }
  return (await res.json()).projects
}

export async function saveToken(owner: string, token: string): Promise<void> {
  if (IS_DEMO) return
  const res = await fetch(`${BASE}/config/tokens/${encodeURIComponent(owner)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error(`Failed to save token: ${res.status}`)
}

export async function removeToken(owner: string): Promise<void> {
  if (IS_DEMO) return
  const res = await fetch(`${BASE}/config/tokens/${encodeURIComponent(owner)}`, { method: 'DELETE', headers: JSON_HEADERS })
  if (!res.ok) throw new Error(`Failed to remove token: ${res.status}`)
}

export async function fetchGithubRepos(owner: string): Promise<GithubRepoSummary[]> {
  const res = await fetch(`${BASE}/config/github/${encodeURIComponent(owner)}/repos`)
  if (!res.ok) throw new Error(`Failed to list repos: ${res.status}`)
  return res.json()
}

export async function fetchGithubBranches(owner: string, repo: string): Promise<string[]> {
  const res = await fetch(`${BASE}/config/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`)
  if (!res.ok) throw new Error(`Failed to list branches: ${res.status}`)
  return res.json()
}

export async function fetchGithubTree(owner: string, repo: string, branch: string, path: string): Promise<string[]> {
  const params = new URLSearchParams({ branch, path })
  const res = await fetch(`${BASE}/config/github/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree?${params}`)
  if (!res.ok) throw new Error(`Failed to list tree: ${res.status}`)
  return res.json()
}

export async function fetchFsListing(path?: string): Promise<FsListing> {
  const params = path ? `?${new URLSearchParams({ path })}` : ''
  const res = await fetch(`${BASE}/config/fs${params}`)
  if (!res.ok) throw new Error(`Failed to browse folder: ${res.status}`)
  return res.json()
}
