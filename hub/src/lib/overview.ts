import type { Store } from '../source/store'
import { SECTIONS, label } from './sections'
import { docHref } from './list'
import { dayLabel } from './format'
import type { Dot, Overview, Product } from './overview-types'
import { parseOverview, parseProduct } from './overview-types'

export const overviewBase = (project: string) => `/p/${project}/overview`

/** index.json and loops.json of context/overview/, or null when the generator has not run. */
export async function loadOverview(store: Store): Promise<Overview | null> {
  if (!(await store.tree('overview'))) return null
  const files = await store.texts('overview', ['index.json', 'loops.json'])
  const text = (name: string) => files.find((f) => f.name === name)?.text ?? ''
  const index = text('index.json')
  return index ? parseOverview(index, text('loops.json')) : null
}

export async function loadProduct(store: Store, id: string): Promise<Product | null> {
  if (!/^[\w-]+$/.test(id)) return null
  const [file] = await store.texts('overview-products', [`${id}.json`])
  return file ? parseProduct(file.text) : null
}

export async function loadProducts(store: Store, ids: string[]): Promise<Product[]> {
  const files = await store.texts('overview-products', ids.map((id) => `${id}.json`))
  return files.flatMap((f) => parseProduct(f.text) ?? [])
}

/** "2026-11-25" -> "25.11" */
export const dm = (d: string) => (d.length >= 10 ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : d)
/** "2026-11-25 07:00" -> "25.11 07h" */
export const lastLabel = (s: string) => (s.length > 10 ? `${dm(s)} ${s.slice(11, 13)}h` : s ? dm(s) : '')

/**
 * A people's doc by slug: overview/docs first, then the folders it moved out of,
 * so a link works before and after the move. Relative pictures and links are read
 * as if the file still sat in docs/, where they were written.
 */
export async function findOverviewDoc(store: Store, slug: string) {
  for (const folder of ['overview-docs', 'docs', 'processes'] as const) {
    const entry = await store.doc(folder, slug)
    if (entry) return { ...entry, path: folder === 'overview-docs' ? `docs/${entry.name}` : entry.path }
  }
  return null
}

// ---- search ------------------------------------------------------------------

export interface Hit {
  title: string
  summary: string
  href: string
  group: string
  chip: string
  meta?: string
}
export interface HitGroup {
  key: string
  title: string
  hits: Hit[]
}

const MAX_PER_GROUP = 15
const terms = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)
const matches = (words: string[], ...fields: string[]) => {
  const hay = fields.join(' ').toLowerCase()
  return words.every((w) => hay.includes(w))
}

function dotHit(project: string, p: Product, d: Dot): Hit {
  return { title: `${p.name}: ${d.title}`, summary: d.detail, href: `${overviewBase(project)}/${p.id}#${d.id}`, group: 'dots', chip: 'Overview', meta: dm(d.date) }
}

/**
 * Titles and summaries only: the Overview dots, loops and docs, then every
 * section's cached metas (one KV read per unchanged section).
 */
export async function searchHub(store: Store, project: string, q: string, say: (s: string) => string): Promise<HitGroup[]> {
  const words = terms(q)
  if (!words.length) return []
  const groups: HitGroup[] = []
  const add = (key: string, title: string, hits: Hit[]) => hits.length && groups.push({ key, title, hits: hits.slice(0, MAX_PER_GROUP) })
  const overview = await loadOverview(store)
  if (overview) {
    const products = await loadProducts(store, overview.products.map((p) => p.id))
    add('dots', 'Roadmap dots', products.flatMap((p) => p.dots.filter((d) => matches(words, p.name, d.title, d.detail)).map((d) => dotHit(project, p, d))))
    add(
      'loops',
      'Loops',
      overview.loops
        .filter((l) => matches(words, l.name, l.what))
        .map((l) => ({ title: l.name, summary: l.what, href: `${overviewBase(project)}/loops#${l.id}`, group: 'loops', chip: 'Overview', meta: l.state })),
    )
    add(
      'docs',
      'Docs',
      overview.docs.filter((d) => matches(words, d.title, d.note)).map((d) => ({ title: d.title, summary: d.note, href: `${overviewBase(project)}/docs/${d.slug}`, group: 'docs', chip: 'Overview docs' })),
    )
  }
  // One section at a time: a cold store would otherwise open every section's GitHub reads at once.
  for (const s of SECTIONS) {
    const metas = await store.allMetas(s)
    add(
      s,
      label(s),
      metas
        .filter((m) => matches(words, m.title, m.summary ?? '', m.slug))
        .map((m) => ({ title: say(m.title), summary: say(m.summary ?? ''), href: docHref(project, s, m.slug), group: s, chip: label(s), meta: m.date ? dayLabel(m.date) : undefined })),
    )
  }
  return groups
}

