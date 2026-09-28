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
  'loops',
  'research',
] as const

export type BaseFolderKey = (typeof FOLDERS)[number]

// 'plans-archived' is not a repo-level folder like the rest — it maps to plans/archived,
// which the old tree query for 'plans' never descended into. 'progress-standup' is
// where one store keeps its standups (progress/standup); see withFolderFallbacks.
export type FolderKey = BaseFolderKey | 'plans-archived' | 'progress-standup'

export const ALL_FOLDERS: readonly FolderKey[] = [...FOLDERS, 'plans-archived', 'progress-standup']

export function isFolderKey(value: string): value is FolderKey {
  return ALL_FOLDERS.some((key) => key === value)
}

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

// A folder's README describes the folder; it is not one of its documents.
export function isDocument(name: string): boolean {
  return isMarkdown(name) && !/^readme\.mdx?$/i.test(name)
}

// Where a folder may live when its canonical path is absent. Stores differ:
// one keeps standups at standups/, another under progress/standup/.
const FOLDER_FALLBACKS: Partial<Record<FolderKey, FolderKey>> = {
  standups: 'progress-standup',
}

export function withFolderFallbacks(source: ContextSource): ContextSource {
  return {
    async list(folder) {
      const primary = await source.list(folder)
      const fallback = FOLDER_FALLBACKS[folder]
      if (primary !== null || !fallback) return primary
      return source.list(fallback)
    },
    async read(folder, names) {
      const found = await source.read(folder, names)
      const fallback = FOLDER_FALLBACKS[folder]
      if (!fallback || found.length === names.length) return found
      const have = new Set(found.map((f) => f.name))
      const missing = names.filter((n) => !have.has(n))
      const rest = await source.read(fallback, missing)
      return [...found, ...rest]
    },
  }
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
  const body = match[2]?.trim() || undefined
  const strict = tryYaml(yaml)
  if (strict !== undefined) return strict === null ? null : { frontmatter: strict, body }
  // The usual break is an unescaped ' inside a '...' scalar (a task desc such as
  // "the buttons' centre"). Re-quote those lines and parse again so the plan
  // keeps its tasks and acceptance list.
  const repaired = tryYaml(repairSingleQuotes(yaml))
  if (repaired !== undefined) return repaired === null ? null : { frontmatter: repaired, body }
  // Still broken: keep the top-level scalars, and the task rows line by line,
  // rather than hide the document.
  const frontmatter = topLevelScalars(yaml)
  const tasks = recoverTasks(yaml)
  if (tasks.length > 0) frontmatter.tasks = tasks
  return { frontmatter, body }
}

const TASK_FIELD_RE = /^\s+(?:-\s+)?(id|desc|title|status):\s+(.*)$/
const unquote = (v: string) => {
  const t = v.trim().replace(/,$/, '')
  const quote = t[0] ?? ''
  if (quote !== "'" && quote !== '"') return t
  // A scalar folded over several lines has no closing quote on this line: keep the whole first line.
  const close = t.length > 1 && t.endsWith(quote) ? t.lastIndexOf(quote) : t.lastIndexOf(`${quote} `)
  const inner = t.slice(1, close > 0 ? close : undefined)
  return quote === "'" ? inner.replace(/''/g, "'") : inner
}
// Last resort for a tasks block js-yaml cannot read at all: one row per
// `- id:`, with the first line of its desc/title and its status.
export function recoverTasks(yaml: string): Record<string, string>[] {
  const lines = yaml.split('\n')
  const start = lines.findIndex((l) => /^tasks:\s*$/.test(l))
  if (start < 0) return []
  const tasks: Record<string, string>[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (/^\S/.test(line)) break
    const m = line.match(TASK_FIELD_RE)
    if (!m?.[1] || m[2] === undefined) continue
    if (/^\s+-\s+/.test(line) || tasks.length === 0) tasks.push({})
    const task = tasks[tasks.length - 1]
    if (task && task[m[1]] === undefined) task[m[1]] = unquote(m[2])
  }
  return tasks.filter((t) => typeof t.id === 'string')
}

// undefined = YAML error, null = parsed but not a mapping
function tryYaml(yaml: string): Record<string, unknown> | null | undefined {
  try {
    const parsed: unknown = parseYaml(yaml)
    return isRecord(parsed) ? parsed : null
  } catch {
    return undefined
  }
}

const QUOTED_OPEN_RE = /^(\s*(?:-\s+)?[A-Za-z_][\w-]*:\s+)'(.*)$/
const DOUBLED_QUOTE = '\u0000'
const escapeInner = (text: string) => text.split("''").join(DOUBLED_QUOTE).replace(/'/g, "''").split(DOUBLED_QUOTE).join("''")
const indentOf = (line: string) => line.length - line.trimStart().length

// Escapes stray apostrophes inside '...' scalars, one line or folded over
// several: a folded scalar ends at the first line closing with ' whose next
// non-blank line sits at or left of the key's indentation.
export function repairSingleQuotes(yaml: string): string {
  const lines = yaml.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const m = line.match(QUOTED_OPEN_RE)
    if (!m?.[1] || m[2] === undefined) {
      out.push(line)
      continue
    }
    const head = m[1]
    // For a list item the key sits after "- ", and its siblings align with it.
    const keyIndent = (head.match(/^\s*(?:-\s+)?/)?.[0] ?? '').length
    let end = i
    // A writer once left "...'," behind: a comma after the closing quote counts as closed.
    const tail = (n: number) => (lines[n] ?? '').trimEnd().replace(/,$/, '')
    const closes = (n: number) => {
      const text = tail(n)
      if (!text.endsWith("'") || (n === i && text === `${head}'`)) return false
      let next = n + 1
      while (next < lines.length && (lines[next] ?? '').trim() === '') next++
      return next >= lines.length || indentOf(lines[next] ?? '') <= keyIndent
    }
    while (end < lines.length && !closes(end)) end++
    if (end >= lines.length) {
      out.push(line)
      continue
    }
    const first = end === i ? tail(i).slice(head.length + 1, -1) : m[2]
    out.push(`${head}'${escapeInner(first)}${end === i ? "'" : ''}`)
    for (let n = i + 1; n <= end; n++) {
      out.push(n === end ? `${escapeInner(tail(n).slice(0, -1))}'` : escapeInner(lines[n] ?? ''))
    }
    i = end
  }
  return out.join('\n')
}

const SCALAR_LINE_RE = /^([A-Za-z_][\w-]*):\s*(?:'((?:[^']|'')*)'|"([^"]*)"|([^'"\s][^#]*?))\s*$/
function topLevelScalars(yaml: string): Record<string, unknown> {
  const out: Record<string, unknown> = { frontmatterError: true }
  for (const line of yaml.split('\n')) {
    const m = line.match(SCALAR_LINE_RE)
    if (!m?.[1]) continue
    const value = m[2] !== undefined ? m[2].replace(/''/g, "'") : (m[3] ?? m[4] ?? '')
    out[m[1]] = /^\d+$/.test(value) ? Number(value) : value
  }
  return out
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
