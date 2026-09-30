import type { Folder } from '../doc/types'
import type { Store } from '../source/store'
import type { DocMeta } from '../source/meta'
import { stripCodes } from '../doc/plain'

export const PAGE_SIZE = 20

export interface ListRow {
  slug: string
  href: string
  title: string
  summary?: string
  date: string | null
  status?: string
  progress?: { done: number; total: number }
}

export interface ListPage {
  total: number
  page: number
  items: ListRow[]
}

export function docHref(project: string, section: Folder, slug: string): string {
  return section === 'plans' ? `/p/${project}/plan/${slug}` : `/p/${project}/${section}/${slug}`
}

function row(project: string, section: Folder, m: DocMeta, plain: boolean): ListRow {
  const say = (s: string) => (plain ? stripCodes(s).trim() || s : s)
  return {
    slug: m.slug,
    href: docHref(project, section, m.slug),
    title: say(m.title),
    summary: m.summary ? say(m.summary) : undefined,
    date: m.date,
    status: m.status,
    progress: m.progress,
  }
}

/** One page of a section. A status or text filter reads the whole section's metas (cached by folder SHA). */
export async function listPage(store: Store, project: string, section: Folder, opts: { page: number; status?: string; q?: string; plain: boolean }): Promise<ListPage> {
  const { page, status, q, plain } = opts
  if (!status && !q) {
    const res = await store.page(section, page, PAGE_SIZE)
    return { total: res.total, page, items: res.items.map((m) => row(project, section, m, plain)) }
  }
  const needle = q?.toLowerCase().trim()
  const all = (await store.allMetas(section)).filter(
    (m) => (!status || (m.status ?? (section === 'plans' ? 'active' : '')) === status) && (!needle || m.title.toLowerCase().includes(needle) || m.slug.includes(needle)),
  )
  return { total: all.length, page, items: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((m) => row(project, section, m, plain)) }
}
