export type Folder =
  | 'plans'
  | 'roadmaps'
  | 'references'
  | 'progress'
  | 'ideas'
  | 'processes'
  | 'handoffs'
  | 'archive'

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
  created?: string
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

export const FOLDER_LABELS: Record<Folder, string> = {
  plans: 'Plans',
  roadmaps: 'Roadmaps',
  references: 'References',
  progress: 'Progress',
  ideas: 'Ideas',
  processes: 'Processes',
  handoffs: 'Handoffs',
  archive: 'Archive',
}
