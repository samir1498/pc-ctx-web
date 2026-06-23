export type Folder = 'plans' | 'roadmaps' | 'references' | 'progress'

export interface ContextItem {
  slug: string
  name: string
  path: string
  frontmatter?: Record<string, unknown>
  body?: string
}

export interface ContextItemDetail extends ContextItem {
  frontmatter: Record<string, unknown>
  body: string
}

export const FOLDER_LABELS: Record<Folder, string> = {
  plans: 'Plans',
  roadmaps: 'Roadmaps',
  references: 'References',
  progress: 'Progress',
}
