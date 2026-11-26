import type { Store } from '../source/store'
import { SECTIONS, label } from './sections'
import { docHref } from './list'
import { dayLabel, monthKey, monthShort } from './format'
import type { Dot, Overview, Product, StripDot } from './overview-types'
import { parseOverview, parseProduct } from './overview-types'

export const overviewBase = (project: string) => `/p/${project}/overview`

export interface OverviewNav {
  /** Shown beside the closed group. */
  count: number
  /** Empty while the group is closed. */
  children: { id: string; label: string; n: number }[]
}

/**
 * The sidebar's Overview group. Closed it needs only the child count, which the file tree
 * gives for free; open it reads the generator's index for the names and counts.
 */
export async function overviewNav(store: Store, open: boolean): Promise<OverviewNav | null> {
  if (!(await store.tree('overview'))) return null
  if (!open) {
    const products = await store.entries('overview-products')
    return { count: products.length + 2, children: [] }
  }
  const overview = await loadOverview(store)
  if (!overview) return null
  const children = [
      ...overview.products.map((p) => ({ id: p.id, label: p.name, n: p.dots })),
      { id: 'loops', label: 'Loops', n: overview.loops.length },
      { id: 'docs', label: 'Docs', n: overview.docs.length },
  ]
  return { count: children.length, children }
}

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

const dayNumber = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 864e5

/** One time axis for every product on the home page: from the first month with a dot to today, in percent. */
export function sharedAxis(dots: StripDot[], today: string) {
  const first = dots.map((d) => d.date).sort()[0] ?? today
  const start = dayNumber(`${monthKey(first)}-01`)
  const span = Math.max(dayNumber(today) - start, 1)
  const at = (d: string) => ((dayNumber(d) - start) / span) * 100
  const months = [...new Set(dots.map((d) => monthKey(d.date)))].sort().map((m) => ({ label: monthShort(m), at: at(`${m}-01`) }))
  return { at, months }
}

/** The "## " headings of a doc, trimmed to the bare words: what is inside it. */
export const docHeadings = (text: string): string[] =>
  [...text.matchAll(/^## (.*)$/gm)].map((m) => (m[1] ?? '').replace(/\s*\(.*\)$/, '').replace(/^\d+\.\s*/, '').trim()).filter(Boolean)

/** Each doc's headings by slug, read from overview/docs once. */
export async function loadDocHeadings(store: Store, slugs: string[]): Promise<Map<string, string[]>> {
  const files = await store.texts('overview-docs', slugs.map((s) => `${s}.md`))
  return new Map(files.map((f) => [f.name.replace(/\.md$/, ''), docHeadings(f.text)]))
}

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

function dotHit(project: string, p: Product, d: Dot, say: (s: string) => string): Hit {
  return { title: say(`${p.name}: ${d.title}`), summary: say(d.detail), href: `${overviewBase(project)}/${p.id}#${d.id}`, group: 'dots', chip: 'Overview', meta: dm(d.date) }
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
  // A malformed Overview file must not take the other sections' search down with it.
  try {
    const overview = await loadOverview(store)
    if (overview) {
      const products = await loadProducts(store, overview.products.map((p) => p.id))
      add('dots', 'Roadmap dots', products.flatMap((p) => p.dots.filter((d) => matches(words, p.name, d.title, d.detail)).map((d) => dotHit(project, p, d, say))))
      add(
        'loops',
        'Loops',
        overview.loops
          .filter((l) => matches(words, l.name, l.what))
          .map((l) => ({ title: say(l.name), summary: say(l.what), href: `${overviewBase(project)}/loops#${l.id}`, group: 'loops', chip: 'Overview', meta: l.state })),
      )
      add(
        'docs',
        'Docs',
        overview.docs.filter((d) => matches(words, d.title, d.note)).map((d) => ({ title: say(d.title), summary: say(d.note), href: `${overviewBase(project)}/docs/${d.slug}`, group: 'docs', chip: 'Overview docs' })),
      )
    }
  } catch (err) {
    console.error('overview search skipped', err)
  }
  // One section at a time: a cold store would otherwise open every section's GitHub reads at once.
  for (const s of SECTIONS) {
    const metas = await store.allMetas(s).catch((err) => {
      console.error('search skipped section', s, err)
      return []
    })
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

