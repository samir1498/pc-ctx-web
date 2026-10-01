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
  'loops',
  'research',
  'designs',
] as const

export type BaseFolderKey = (typeof FOLDERS)[number]

// 'plans-archived' maps to plans/archived; 'progress-standup' is where one store
// keeps its standups (see FOLDER_FALLBACKS). 'usage' holds the collector's day files.
export type FolderKey = BaseFolderKey | 'plans-archived' | 'progress-standup' | 'mockups' | 'usage'

export const ALL_FOLDERS: readonly FolderKey[] = [...FOLDERS, 'plans-archived', 'progress-standup', 'mockups', 'usage']

const NESTED_PATHS: Partial<Record<FolderKey, string>> = {
  'plans-archived': 'plans/archived',
  'progress-standup': 'progress/standup',
}

export function folderPath(folder: FolderKey): string {
  return NESTED_PATHS[folder] ?? folder
}

export function isMarkdown(name: string): boolean {
  return name.endsWith('.md') || name.endsWith('.mdx')
}

export function isHtml(name: string): boolean {
  return /\.html?$/i.test(name)
}

// Folders whose pages may be a picture rather than prose: kept as HTML in
// the store and rendered in a sandbox. 'reports' holds dashboard-style
// generated pages, so it belongs here too.
const HTML_FOLDERS: readonly FolderKey[] = ['designs', 'mockups', 'reports']

// A folder's README describes the folder; it is not one of its documents.
export function isDocument(name: string, folder?: FolderKey): boolean {
  if (/^readme\.mdx?$/i.test(name)) return false
  if (folder === 'usage') return /^\d{4}-\d{2}-\d{2}\.json$/.test(name)
  if (isMarkdown(name)) return true
  return folder !== undefined && HTML_FOLDERS.includes(folder) && isHtml(name)
}

// Pictures a page refers to as ../media/<path>. Only this subtree is ever
// served, and only these characters in a path.
export const MEDIA_PATH_RE = /^(?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|pdf)$/i

/**
 * Sent with every media file. `sandbox` puts a file opened by its own URL
 * in an opaque origin, so a script inside an SVG or a PDF never runs as the
 * hub; the rest lets an SVG keep its inline styles and data: fills.
 */
export const MEDIA_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
}

export function mediaContentType(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return MEDIA_TYPES[ext] ?? 'application/octet-stream'
}

export interface MediaFile {
  bytes: ArrayBuffer
  contentType: string
}

// Where a folder may live when its canonical path is absent. Stores differ:
// one keeps standups at standups/, another under progress/standup/.
export const FOLDER_FALLBACKS: Partial<Record<FolderKey, FolderKey>> = {
  standups: 'progress-standup',
  designs: 'mockups',
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
