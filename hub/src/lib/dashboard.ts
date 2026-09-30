import type { Folder } from '../doc/types'
import { titleFromSlug } from '../doc/hub'
import { leadingDateMs } from '../source/folders'
import type { SectionTree } from '../source/store'
import type { DocMeta } from '../source/meta'
import type { Tone } from './sections'
import { SECTIONS, STATUS_SECTIONS } from './sections'

const DAY = 864e5
export const WEEKS = 12

export interface SectionSummary {
  key: Folder
  count: number
  newThisWeek: number
  last30: number
  lastDate: string | null
  /** Files per week by the date in their name, oldest first, WEEKS long. */
  weekly: number[]
  weekStarts: string[]
}

function mondayUtc(ms: number): number {
  const d = new Date(ms)
  const day = (d.getUTCDay() + 6) % 7
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY
}

export function summarize(key: Folder, tree: SectionTree | undefined, now = Date.now()): SectionSummary {
  const dates = (tree?.entries ?? []).map((e) => leadingDateMs(e.name)).filter((d): d is number => d !== null)
  const thisWeek = mondayUtc(now)
  const starts = Array.from({ length: WEEKS }, (_, i) => thisWeek - (WEEKS - 1 - i) * 7 * DAY)
  const weekly = starts.map((s) => dates.filter((d) => d >= s && d < s + 7 * DAY).length)
  const last = dates.length ? Math.max(...dates) : null
  return {
    key,
    count: tree?.entries.length ?? 0,
    newThisWeek: dates.filter((d) => d >= now - 7 * DAY).length,
    last30: dates.filter((d) => d >= now - 30 * DAY).length,
    lastDate: last === null ? null : new Date(last).toISOString().slice(0, 10),
    weekly,
    weekStarts: starts.map((s) => new Date(s).toISOString().slice(0, 10)),
  }
}

export function summarizeAll(trees: Partial<Record<string, SectionTree>>, now = Date.now()): SectionSummary[] {
  return SECTIONS.map((k) => summarize(k, trees[k], now))
}

export interface RecentItem {
  section: Folder
  slug: string
  title: string
  date: string
}

/** Newest dated files across sections, from names alone: no file reads. */
export function recent(trees: Partial<Record<string, SectionTree>>, sections: Folder[], limit = 8): RecentItem[] {
  const out: RecentItem[] = []
  for (const section of sections) {
    for (const e of trees[section]?.entries ?? []) {
      const ms = leadingDateMs(e.name)
      if (ms === null) continue
      const slug = e.name.replace(/\.\w+$/, '')
      out.push({ section, slug, title: titleFromSlug(slug), date: new Date(ms).toISOString().slice(0, 10) })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

export interface StatusCount {
  key: string
  label: string
  tone: Tone
  count: number
}

export function statusCounts(section: Folder, metas: DocMeta[]): StatusCount[] | null {
  const defs = STATUS_SECTIONS[section]
  if (!defs) return null
  const counts = defs.map((d) => ({ ...d, count: metas.filter((m) => (m.status ?? (section === 'plans' ? 'active' : '')) === d.key).length }))
  const known = new Set(defs.map((d) => d.key))
  const other = metas.filter((m) => m.status && !known.has(m.status)).length
  return other ? [...counts, { key: 'other', label: 'Other', tone: 'dim' as Tone, count: other }] : counts
}
