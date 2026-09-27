import type { ContextItem, Frontmatter } from '../types'

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

export function planProgress(item: ContextItem): { done: number; total: number; pct: number } {
  const tasks = item.frontmatter?.tasks
  if (!Array.isArray(tasks) || tasks.length === 0) return { done: 0, total: 0, pct: 0 }
  const done = tasks.filter((t) => t.status === 'done').length
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) }
}

export function planTitle(item: ContextItem): string {
  return item.frontmatter?.title ?? item.slug
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
