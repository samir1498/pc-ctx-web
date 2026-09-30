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
  | 'loops'
  | 'research'
  | 'designs'

export const FOLDERS: readonly Folder[] = [
  'plans',
  'roadmaps',
  'references',
  'progress',
  'ideas',
  'processes',
  'handoffs',
  'archive',
  'reports',
  'standups',
  'loops',
  'research',
  'designs',
]

export function isFolder(value: string): value is Folder {
  return FOLDERS.some((f) => f === value)
}

// Project-scoped board also reads the archived-plans folder, which is not a
// top-level context-store folder (see server/source.ts's 'plans-archived').
export type ProjectFolder = Folder | 'plans-archived'

// pc-ctx writes a task's text as `desc`; older stores used `title`.
export interface Task {
  id: string
  title?: string
  desc?: string
  status?: string
  note?: string
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
  /** 'html' for a page kept as HTML in the store, rendered in a sandbox. */
  kind?: string
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
  loops: 'Loops',
  research: 'Research',
  designs: 'Designs',
}

// Singular, for a page heading and a breadcrumb ("Report", "Standup").
export const FOLDER_SINGULAR: Record<Folder, string> = {
  plans: 'Plan',
  roadmaps: 'Roadmap',
  references: 'Reference',
  progress: 'Progress note',
  ideas: 'Idea',
  processes: 'Process',
  handoffs: 'Handoff',
  archive: 'Archived page',
  reports: 'Report',
  standups: 'Standup',
  loops: 'Loop',
  research: 'Research note',
  designs: 'Design page',
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
