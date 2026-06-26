import type { ContextItem } from '../types'

// ---- status / priority palette (matches v2 design tokens) ----
const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  done: '#3b82f6',
  paused: '#f59e0b',
  cancelled: '#ef4444',
  planned: '#6b6b70',
  'in-progress': '#f59e0b',
  pending: '#6b6b70',
  blocked: '#ef4444',
  superseded: '#6b6b70',
}

export function statusColor(status?: string): string {
  return STATUS_COLOR[status ?? ''] ?? '#6b6b70'
}

export function priorityColor(prio?: number): string {
  if (prio === undefined) return '#6b6b70'
  if (prio >= 80) return '#ef4444'
  if (prio >= 50) return '#f59e0b'
  return '#6b6b70'
}

export function taskMark(status?: string): string {
  switch (status) {
    case 'done':
      return '✓'
    case 'in-progress':
      return '◐'
    case 'blocked':
    case 'cancelled':
      return '✗'
    default:
      return '○'
  }
}

export function taskCounts(item: ContextItem): { done: number; total: number } | null {
  const tasks = item.frontmatter?.tasks
  if (!Array.isArray(tasks)) return null
  return { done: tasks.filter((t) => t.status === 'done').length, total: tasks.length }
}

// ---- dates: pc-ctx stores `created` as YYYYMMDD number or an ISO-ish string ----
export function parseCreated(created?: string | number): Date | null {
  if (created === undefined || created === null) return null
  const s = String(created).trim()
  if (/^\d{8}$/.test(s)) {
    const d = new Date(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// ISO 8601 week-numbering [year, week]
export function isoWeek(date: Date): [number, number] {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = d.getTime()
  d.setUTCMonth(0, 1)
  if (d.getUTCDay() !== 4) {
    d.setUTCMonth(0, 1 + ((4 - d.getUTCDay() + 7) % 7))
  }
  const week = 1 + Math.round((firstThursday - d.getTime()) / 604800000)
  return [new Date(firstThursday).getUTCFullYear(), week]
}

/** Resolve an entry's [year, week] from `created`, falling back to a `YYYY-Www` filename. */
function entryWeek(item: ContextItem): [number, number] | null {
  const d = parseCreated(item.frontmatter?.created)
  if (d) return isoWeek(d)
  const m = item.name.match(/(\d{4})-W(\d{2})/i)
  if (m) return [Number(m[1]), Number(m[2])]
  return null
}

/**
 * Build a weekly-activity series from progress entries, repo-agnostic:
 * buckets by the ISO week of `created`, or by a `YYYY-Www` filename when there is
 * no `created` field. The old code required the filename form and found nothing
 * when entries were title-slug named — this handles both conventions.
 * Value = bullet lines across that week's entries (a real activity proxy, min 1).
 */
export function weeklyActivity(
  items: ContextItem[] | undefined,
  weeks = 8,
): { label: string; value: number }[] {
  if (!items?.length) return []
  const buckets = new Map<string, { year: number; week: number; value: number }>()
  for (const item of items) {
    const yw = entryWeek(item)
    if (!yw) continue
    const [year, week] = yw
    const key = `${year}-${String(week).padStart(2, '0')}`
    const bullets = (item.body ?? '').split('\n').filter((l) => /^\s*[-*] /.test(l)).length
    const add = Math.max(bullets, 1)
    const prev = buckets.get(key)
    if (prev) prev.value += add
    else buckets.set(key, { year, week, value: add })
  }
  return [...buckets.values()]
    .sort((a, b) => a.year - b.year || a.week - b.week)
    .slice(-weeks)
    .map((b) => ({ label: `W${String(b.week).padStart(2, '0')}`, value: b.value }))
}
