import { load as parseYaml } from 'js-yaml'

export const FOLDERS = [
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
] as const

export type BaseFolderKey = (typeof FOLDERS)[number]

// 'plans-archived' is not a repo-level folder like the rest — it maps to plans/archived,
// which the old tree query for 'plans' never descended into.
export type FolderKey = BaseFolderKey | 'plans-archived'

export const ALL_FOLDERS: readonly FolderKey[] = [...FOLDERS, 'plans-archived']

export function isFolderKey(value: string): value is FolderKey {
  return ALL_FOLDERS.some((key) => key === value)
}

export function folderPath(folder: FolderKey): string {
  return folder === 'plans-archived' ? 'plans/archived' : folder
}

export function isMarkdown(name: string): boolean {
  return name.endsWith('.md') || name.endsWith('.mdx')
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface FolderEntry {
  slug: string
  name: string
  path: string
  frontmatter?: Record<string, unknown>
  body?: string
}

export interface ListEntry {
  slug: string
  name: string
  path: string
}

export interface ContextSource {
  list(folder: FolderKey): Promise<ListEntry[] | null>
  read(folder: FolderKey, names: string[]): Promise<FolderEntry[]>
}

export function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body?: string } | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---(?:\n([\s\S]*))?$/)
  if (!match) return null
  const yaml = match[1]
  if (!yaml) return null
  try {
    const parsed: unknown = parseYaml(yaml)
    if (!isRecord(parsed)) return null
    return { frontmatter: parsed, body: match[2]?.trim() || undefined }
  } catch {
    return null
  }
}

export function toEntry(folder: FolderKey, name: string, raw: string): FolderEntry {
  const parsed = parseFrontmatter(raw)
  return {
    slug: name.replace(/\.\w+$/, ''),
    name,
    path: `${folderPath(folder)}/${name}`,
    ...(parsed ? { frontmatter: parsed.frontmatter, body: parsed.body } : { body: raw }),
  }
}

export function toListEntry(folder: FolderKey, name: string): ListEntry {
  return { slug: name.replace(/\.\w+$/, ''), name, path: `${folderPath(folder)}/${name}` }
}

// Leading YYYY-MM-DD (dashed or not) sorts newest-first; everything else falls back
// to name order. One implementation shared by every source keeps pagination order stable.
export function leadingDateMs(name: string): number | null {
  const m = name.match(/^(\d{4})-?(\d{2})-?(\d{2})/)
  if (!m) return null
  const [, y, mo, d] = m
  const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`)
  const ms = dt.getTime()
  if (Number.isNaN(ms)) return null
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(mo) || dt.getUTCDate() !== Number(d)) {
    return null
  }
  return ms
}

export function sortListEntries<T extends { name: string }>(entries: T[]): T[] {
  return entries
    .map((entry) => ({ entry, date: leadingDateMs(entry.name) }))
    .sort((a, b) => {
      if (a.date !== null && b.date !== null) return b.date - a.date
      if (a.date !== null) return -1
      if (b.date !== null) return 1
      return a.entry.name.localeCompare(b.entry.name)
    })
    .map((x) => x.entry)
}
