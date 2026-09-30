import type { ContextItem, Frontmatter, ListEntry, Task } from './types'

/** frontmatter.shots is an untyped index-signature field; narrow it to string[] without a cast. */
export function shotsOf(fm: Frontmatter | undefined): string[] {
  const raw = fm?.shots
  if (!Array.isArray(raw)) return []
  return raw.filter((s): s is string => typeof s === 'string')
}

export type PlanBucket = 'active' | 'paused' | 'done'

/** Board column for a live plan; anything else (e.g. cancelled) shows on no column, matching the mockup. */
export function planBucket(item: ContextItem): PlanBucket | null {
  const status = item.frontmatter?.status
  if (status === 'active' || status === 'paused' || status === 'done') return status
  if (status === undefined) return 'active'
  return null
}

/** "n of m done": cancelled tasks leave the denominator, so a plan can reach 100%. */
export function planProgress(item: ContextItem): { done: number; total: number; pct: number } {
  const tasks = item.frontmatter?.tasks
  if (!Array.isArray(tasks) || tasks.length === 0) return { done: 0, total: 0, pct: 0 }
  const done = tasks.filter((t) => t.status === 'done').length
  const total = tasks.filter((t) => t.status !== 'cancelled').length
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

const TASK_ORDER: Record<string, number> = { 'in-progress': 0, blocked: 1, pending: 2 }
export const CLOSED_TASK_STATUSES = new Set(['done', 'cancelled'])

/**
 * Open tasks first (in progress, blocked, then pending in file order), closed
 * ones (done, cancelled) kept apart so a long list can fold them away.
 */
export function groupTasks(tasks: Task[]): { open: Task[]; closed: Task[] } {
  const open = tasks.filter((t) => !CLOSED_TASK_STATUSES.has(t.status ?? 'pending'))
  const closed = tasks.filter((t) => CLOSED_TASK_STATUSES.has(t.status ?? 'pending'))
  const rank = (t: Task) => TASK_ORDER[t.status ?? 'pending'] ?? 2
  return { open: open.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map((x) => x.t), closed }
}

export function countByStatus(tasks: Task[]): [string, number][] {
  const counts = new Map<string, number>()
  for (const t of tasks) counts.set(t.status ?? 'pending', (counts.get(t.status ?? 'pending') ?? 0) + 1)
  return [...counts.entries()]
}

export function planTitle(item: ContextItem): string {
  return item.frontmatter?.title ?? titleFromSlug(item.slug)
}

export function taskText(task: Task): string {
  return task.desc ?? task.title ?? task.id
}

/** First two non-heading paragraphs of a markdown body — the home page's "where it stands" lede. */
export function firstParagraphs(body: string, count = 2): string {
  return body
    .split(/\n{2,}/)
    .filter((block) => block.trim() && !/^#/.test(block.trim()))
    .slice(0, count)
    .join('\n\n')
}

export function formatDate(created: string | number | undefined): string {
  const s = String(created ?? '').replace(/-/g, '')
  if (s.length >= 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return ''
}

const DATE_PREFIX_RE = /^(\d{4})-?(\d{2})-?(\d{2})[-_]?/

/** "20260927-finish-the-shop" → "Finish the shop"; a bare "2026-09-22" stays a date. */
export function titleFromSlug(slug: string): string {
  const rest = slug.replace(DATE_PREFIX_RE, '')
  if (!rest) return isoDateFromSlug(slug) ?? slug
  const words = rest.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function isoDateFromSlug(slug: string): string | null {
  const m = slug.match(DATE_PREFIX_RE)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** The date a document carries, as YYYY-MM-DD: frontmatter first, then the file name. */
export function docDate(item: { slug: string; frontmatter?: Frontmatter }): string | null {
  const fm = item.frontmatter
  const raw = fm?.date ?? fm?.created
  if (raw !== undefined && raw !== null) {
    // An unquoted YAML date parses as a Date, serialized as an ISO string; keep the date part.
    const s = String(raw).replace(/T.*$/, '')
    const digits = s.replace(/-/g, '')
    if (/^\d{8}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return isoDateFromSlug(item.slug)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-09-22" → "22 Sep 2026" (or "22 Sep" when the year is the current one). */
export function shortDate(iso: string | null, now = new Date()): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const month = MONTHS[m - 1] ?? ''
  return y === now.getFullYear() ? `${d} ${month}` : `${d} ${month} ${y}`
}

/** A leading "# Heading" in a body, split off so the page shows it once. */
export function splitLeadingHeading(body: string): { heading: string | null; rest: string } {
  const m = body.match(/^\s*#\s+(.+?)\s*\n+([\s\S]*)$/)
  if (!m) return { heading: null, rest: body }
  return { heading: m[1] ?? null, rest: m[2] ?? '' }
}

/** Title for any document: frontmatter, else its first heading, else its file name. */
export function docTitle(item: { slug: string; frontmatter?: Frontmatter; body?: string }): string {
  const fromFm = item.frontmatter?.title
  if (typeof fromFm === 'string' && fromFm.trim()) return fromFm
  if (item.body) {
    const { heading } = splitLeadingHeading(item.body)
    if (heading) return heading
  }
  return titleFromSlug(item.slug)
}

export function listTitle(entry: ListEntry): string {
  return titleFromSlug(entry.slug)
}

const BARE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** A page named only by its date reads as "Standup, 22 Sep" rather than "2026-09-22". */
export function displayTitle(item: { slug: string; frontmatter?: Frontmatter; body?: string }, singular: string, now = new Date()): string {
  const title = docTitle(item)
  if (BARE_DATE_RE.test(title)) return `${singular}, ${shortDate(title, now)}`
  return title
}
