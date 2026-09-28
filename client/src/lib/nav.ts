import type { ContextItem, Folder, ListEntry } from '../types'
import { FOLDER_LABELS, FOLDER_SINGULAR } from '../types'
import { displayTitle, docDate, docTitle, planBucket, shortDate, titleFromSlug } from './hub'

export interface NavItem {
  label: string
  to: string
  current: boolean
  /** A quieter row: "all 12 reports", "9 more". */
  muted?: boolean
  /** Small right-aligned text: a date or a count. */
  meta?: string
}

export interface NavGroup {
  key: string
  label: string
  /** Where the group heading itself goes, when it is a link. */
  to?: string
  current?: boolean
  items: NavItem[]
}

export interface SidebarInput {
  project: string
  /** The current location's pathname, e.g. /p/dinar/plan/x. */
  path: string
  counts?: Partial<Record<Folder, number>>
  plans?: ContextItem[]
  reports?: ContextItem[]
  standups?: ContextItem[]
  roadmaps?: ContextItem[]
  /** Names-only listing of the folder the reader is currently inside, if any. */
  folderItems?: { folder: Folder; items: ListEntry[] }
  /** Rewrites a label for the plain audience (drops codes). Identity by default. */
  label?: (text: string) => string
}

export const paths = {
  home: (p: string) => `/p/${p}`,
  board: (p: string) => `/p/${p}/plans`,
  plan: (p: string, slug: string) => `/p/${p}/plan/${slug}`,
  folder: (p: string, folder: Folder) => `/p/${p}/${folder}`,
  doc: (p: string, folder: Folder, slug: string) => `/p/${p}/${folder}/${slug}`,
}

/** The folders that get a row under "Library", in reading order. */
export const LIBRARY_FOLDERS: readonly Folder[] = [
  'progress',
  'handoffs',
  'processes',
  'research',
  'loops',
  'references',
  'ideas',
  'archive',
]

const PLAN_CAPS = { active: 8, paused: 5, done: 4 } as const
const RECENT = 3
const FOLDER_CAP = 15

function normalize(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed || '/'
}

/** Pulls the pieces out of a hub path: which project, which folder, which slug. */
export function parseHubPath(path: string): { project: string; folder: Folder | 'plan' | 'plans' | null; slug: string | null } | null {
  const m = normalize(path).match(/^\/p\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/)
  if (!m?.[1]) return null
  const folder = m[2] ?? null
  const slug = m[3] ?? null
  if (folder === null) return { project: m[1], folder: null, slug: null }
  if (folder === 'plan' || folder === 'plans') return { project: m[1], folder, slug }
  if ((Object.keys(FOLDER_LABELS) as Folder[]).includes(folder as Folder)) return { project: m[1], folder: folder as Folder, slug }
  return { project: m[1], folder: null, slug: null }
}

export function buildSidebar(input: SidebarInput): NavGroup[] {
  const { project } = input
  const path = normalize(input.path)
  const label = input.label ?? ((t: string) => t)
  const here = parseHubPath(path)
  const is = (to: string) => normalize(to) === path
  const groups: NavGroup[] = []

  groups.push({
    key: 'start',
    label: '',
    items: [
      { label: 'Overview', to: paths.home(project), current: is(paths.home(project)) },
      {
        label: 'All plans',
        to: paths.board(project),
        current: is(paths.board(project)),
        meta: input.counts?.plans !== undefined ? String(input.counts.plans) : undefined,
      },
    ],
  })

  const plans = input.plans ?? []
  const byBucket = { active: [] as ContextItem[], paused: [] as ContextItem[], done: [] as ContextItem[] }
  for (const p of plans) {
    const b = planBucket(p)
    if (b) byBucket[b].push(p)
  }
  const planGroup = (key: keyof typeof byBucket, name: string): NavGroup | null => {
    const list = byBucket[key]
    if (list.length === 0) return null
    const cap = PLAN_CAPS[key]
    const currentSlug = here?.folder === 'plan' ? here.slug : null
    // Keep the plan being read visible even when it sits past the cap.
    let shown = list.slice(0, cap)
    if (currentSlug && !shown.some((p) => p.slug === currentSlug)) {
      const extra = list.find((p) => p.slug === currentSlug)
      if (extra) shown = [...shown.slice(0, Math.max(0, cap - 1)), extra]
    }
    const items: NavItem[] = shown.map((p) => ({
      label: label(docTitle(p)),
      to: paths.plan(project, p.slug),
      current: is(paths.plan(project, p.slug)),
    }))
    if (list.length > shown.length) {
      items.push({ label: `${list.length - shown.length} more`, to: paths.board(project), current: false, muted: true })
    }
    return { key: `plans-${key}`, label: name, to: paths.board(project), items }
  }
  for (const g of [planGroup('active', 'In progress'), planGroup('paused', 'Waiting'), planGroup('done', 'Done')]) {
    if (g) groups.push(g)
  }

  const recentGroup = (folder: 'reports' | 'standups' | 'roadmaps', name: string, items: ContextItem[] | undefined): NavGroup | null => {
    const list = items ?? []
    const count = input.counts?.[folder] ?? list.length
    if (list.length === 0 && count === 0) return null
    const inside = here?.folder === folder
    const shown = inside ? list : list.slice(0, RECENT)
    const rows: NavItem[] = shown.map((it) => {
      const title = docTitle(it)
      const dated = /^\d{4}-\d{2}-\d{2}$/.test(title)
      return {
        label: label(dated ? displayTitle(it, FOLDER_SINGULAR[folder]) : title),
        to: paths.doc(project, folder, it.slug),
        current: is(paths.doc(project, folder, it.slug)),
        meta: dated ? undefined : shortDate(docDate(it)),
      }
    })
    // Inside the folder every page is listed; the index row stays as the way
    // back to the list with dates and summaries.
    if (inside || count > shown.length) {
      rows.push({
        label: `All ${count} ${FOLDER_LABELS[folder].toLowerCase()}`,
        to: paths.folder(project, folder),
        current: is(paths.folder(project, folder)),
        muted: true,
      })
    }
    return { key: folder, label: name, to: paths.folder(project, folder), current: is(paths.folder(project, folder)), items: rows }
  }
  for (const g of [
    recentGroup('reports', 'Reports', input.reports),
    recentGroup('standups', 'Standups', input.standups),
    recentGroup('roadmaps', 'Roadmap', input.roadmaps),
  ]) {
    if (g) groups.push(g)
  }

  const library: NavItem[] = []
  const expanded: NavGroup[] = []
  for (const folder of LIBRARY_FOLDERS) {
    const count = input.counts?.[folder]
    if (!count) continue
    const to = paths.folder(project, folder)
    const inside = here?.folder === folder
    library.push({ label: FOLDER_LABELS[folder], to, current: is(to), meta: String(count) })
    if (inside && input.folderItems?.folder === folder) {
      const entries = input.folderItems.items
      const currentSlug = here?.slug ?? null
      let shown = entries.slice(0, FOLDER_CAP)
      if (currentSlug && !shown.some((e) => e.slug === currentSlug)) {
        const extra = entries.find((e) => e.slug === currentSlug)
        if (extra) shown = [...shown.slice(0, FOLDER_CAP - 1), extra]
      }
      const rows: NavItem[] = shown.map((e) => ({
        label: label(titleFromSlug(e.slug)),
        to: paths.doc(project, folder, e.slug),
        current: is(paths.doc(project, folder, e.slug)),
      }))
      if (entries.length > shown.length) {
        rows.push({ label: `All ${entries.length}`, to, current: false, muted: true })
      }
      expanded.push({ key: `in-${folder}`, label: FOLDER_LABELS[folder], to, current: is(to), items: rows })
    }
  }
  // The open folder's pages sit right under the Library row that opened them.
  if (library.length > 0) {
    groups.push({ key: 'library', label: 'Library', items: library })
    groups.push(...expanded)
  }

  return groups
}

/** The one item marked current, if any — the reader's breadcrumb and the phone title use it. */
export function currentItem(groups: NavGroup[]): NavItem | null {
  for (const g of groups) for (const it of g.items) if (it.current && !it.muted) return it
  return null
}
