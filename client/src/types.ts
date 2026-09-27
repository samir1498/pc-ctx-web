export type Folder =
  | 'plans'
  | 'roadmaps'
  | 'references'
  | 'progress'
  | 'ideas'
  | 'processes'
  | 'handoffs'
  | 'archive'
  | 'reports'
  | 'standups'

// Project-scoped board also reads the archived-plans folder, which is not a
// top-level context-store folder (see server/source.ts's 'plans-archived').
export type ProjectFolder = Folder | 'plans-archived'

export interface Task {
  id: string
  title: string
  status?: string
}

export interface Frontmatter {
  title?: string
  slug?: string
  status?: string
  category?: string
  created?: string | number
  tldr?: string
  priority?: number
  tags?: string[]
  period?: string
  tasks?: Task[] | string
  entries?: unknown[]
  references?: string[]
  [key: string]: unknown
}

export interface ContextItem {
  slug: string
  name: string
  path: string
  frontmatter?: Frontmatter
  body?: string
}

export interface ContextItemDetail extends ContextItem {
  frontmatter: Frontmatter
  body: string
}

export interface PagedResponse<T = ContextItem> {
  total: number
  page: number
  size: number
  items: T[]
}

// Names-only listing entry (no frontmatter/body) — used for folder-wide search.
export interface ListEntry {
  slug: string
  name: string
  path: string
}

export const FOLDER_LABELS: Record<Folder, string> = {
  plans: 'Plans',
  roadmaps: 'Roadmaps',
  references: 'References',
  progress: 'Progress',
  ideas: 'Ideas',
  processes: 'Processes',
  handoffs: 'Handoffs',
  archive: 'Archive',
  reports: 'Reports',
  standups: 'Standups',
}

export type Audience = 'plain' | 'engineering'

export interface ProjectSummary {
  id: string
  name: string
  sourceKind: 'disk' | 'github'
  audience: Audience
}

export interface HubConfig {
  mode: 'local' | 'deployed'
  projects: ProjectConfigEntry[]
  tokens: Record<string, 'set' | 'not set'>
}

export interface DiskProjectConfigEntry {
  id: string
  name: string
  source: 'disk'
  dir: string
  audience?: Audience
}

export interface GithubProjectConfigEntry {
  id: string
  name: string
  source: 'github'
  owner: string
  repo: string
  branch: string
  folder: string
  audience?: Audience
}

export type ProjectConfigEntry = DiskProjectConfigEntry | GithubProjectConfigEntry

export interface FsListing {
  path: string
  parent: string | null
  dirs: string[]
  isContextStore: boolean
}

export interface GithubRepoSummary {
  name: string
  defaultBranch: string
}
