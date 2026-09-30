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
