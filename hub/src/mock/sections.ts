// Sample store content for the mockups. The real hub reads names from the GitHub
// tree and frontmatter from blobs cached by SHA.

export type SectionKey =
  | 'plans' | 'progress' | 'reports' | 'designs' | 'ideas' | 'research'
  | 'references' | 'handoffs' | 'standups' | 'roadmaps' | 'processes' | 'archive'

export interface Status {
  key: string
  label: string
  tone: 'accent' | 'good' | 'warn' | 'bad' | 'dim'
  count: number
}

export interface Item {
  slug: string
  title: string
  date: string
  status?: string
  summary: string
}

export interface Section {
  key: SectionKey
  label: string
  blurb: string
  count: number
  newThisWeek: number
  statuses?: Status[]
  weekly: number[] // last 12 weeks, oldest first
  items: Item[]
}

const W = (seed: number, base: number): number[] =>
  Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round(base * (0.5 + Math.abs(Math.sin(seed + i * 1.7)) * (0.6 + i / 16)))))

const PLAN_TITLES = [
  ['Rewrite the context hub in Astro, fast to load', 'active'],
  ['Token usage collector for Claude Code, opencode and Hermes', 'active'],
  ['Autopilot retries a flaky step once before failing the run', 'active'],
  ['Billing: move seat counts to the org, not the user', 'paused'],
  ['CLI: one config file per project, not per machine', 'active'],
  ['Monitor alerts over Discord with a digest mode', 'done'],
  ['Session replay forensics without watching the video', 'done'],
  ['Sonar scans through one shared CLI for all eight repos', 'done'],
  ['Dinar POS: stamp duty on cash invoices over the threshold', 'active'],
  ['Landing page blog refresh cycle from Search Console', 'paused'],
  ['Worker pool sizing from measured heap, not a guess', 'draft'],
  ['Retire the old dashboard SPA after the Astro switch', 'draft'],
  ['Admin: audit log for every permission change', 'active'],
  ['Backups: restore drill every month, logged', 'cancelled'],
] as const

const GENERIC: Record<Exclude<SectionKey, 'plans'>, string[]> = {
  progress: ['Hub sidebar shell merged, designs and research groups live', 'Sonar main scan green after the coverage fix', 'Autopilot retry shipped behind a flag', 'Dev database reset, fixtures reseeded', 'CLI 0.9 released with the config merge'],
  reports: ['Weekly usage and cost, week 39', 'Autopilot failure causes, September', 'Landing page conversions after the refresh', 'Hub load times before the rewrite', 'Sonar debt by repo'],
  designs: ['Phone app, first run', 'Hub dashboard v2', 'Invoice template, A5', 'Usage page', 'Settings, dark'],
  ideas: ['Per-model budget alerts', 'Hub search across every project', 'Replay digest by email', 'Offline mode for the POS', 'Changelog page generated from PRs'],
  research: ['Astro on Cloudflare: server islands and caching', 'GitHub GraphQL: aliased blob reads, limits', 'Chart libraries for React islands, weight vs features', 'SQLite readers for the opencode store'],
  references: ['Cloudflare Pages limits', 'GitHub GraphQL rate limits', 'Anthropic list prices', 'Supabase migration rules'],
  handoffs: ['Hub: sidebar done, cache key fix open', 'CLI: release notes drafted, tag pending', 'Autopilot: flaky step list for review', 'POS: fiscal rules to confirm with the comptable'],
  standups: ['Standup 30 Sep', 'Standup 29 Sep', 'Standup 26 Sep', 'Standup 25 Sep'],
  roadmaps: ['Q4 product', 'Hub', 'CLI', 'POS'],
  processes: ['Quality gates', 'Database migrations', 'Release process', 'ISO 27001 controls'],
  archive: ['Old dashboard plan', 'Kanban board sync', 'First hub prototype'],
}

function dateAgo(days: number): string {
  return new Date(Date.UTC(2026, 8, 30) - days * 864e5).toISOString().slice(0, 10)
}

function slug(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function items(titles: string[], total: number, status?: (i: number) => string): Item[] {
  return Array.from({ length: total }, (_, i) => {
    const t = titles[i % titles.length]!
    const title = i < titles.length ? t : `${t} (${Math.floor(i / titles.length) + 1})`
    return {
      slug: slug(title),
      title,
      date: dateAgo(Math.round(i * 2.3)),
      status: status?.(i),
      summary: 'One line from the document, taken from its frontmatter or first paragraph.',
    }
  })
}

const planItems: Item[] = items(PLAN_TITLES.map(([t]) => t), 48, (i) => PLAN_TITLES[i % PLAN_TITLES.length]![1])

function statusCounts(list: Item[]): Status[] {
  const defs: Omit<Status, 'count'>[] = [
    { key: 'active', label: 'Active', tone: 'accent' },
    { key: 'draft', label: 'Draft', tone: 'dim' },
    { key: 'paused', label: 'Paused', tone: 'warn' },
    { key: 'done', label: 'Done', tone: 'good' },
    { key: 'cancelled', label: 'Cancelled', tone: 'bad' },
  ]
  return defs.map((d) => ({ ...d, count: list.filter((x) => x.status === d.key).length }))
}

const LABEL: Record<SectionKey, string> = {
  plans: 'Plans', progress: 'Progress', reports: 'Reports', designs: 'Designs', ideas: 'Ideas',
  research: 'Research', references: 'References', handoffs: 'Handoffs', standups: 'Standups',
  roadmaps: 'Roadmaps', processes: 'Processes', archive: 'Archive',
}

const BLURB: Record<SectionKey, string> = {
  plans: 'What is being built, its tasks and where each one stands.',
  progress: 'Dated log of what shipped and what changed.',
  reports: 'Measured write-ups: numbers, charts, findings.',
  designs: 'Kept HTML pages and pictures: mockups and screens.',
  ideas: 'Things worth doing later, not yet planned.',
  research: 'Reading notes and comparisons behind a decision.',
  references: 'Facts to look up: limits, prices, rules.',
  handoffs: 'Where a session stopped and what comes next.',
  standups: 'Daily status pages.',
  roadmaps: 'Longer arcs, grouped by product.',
  processes: 'How the team builds, tests and ships.',
  archive: 'Finished or dropped, kept for the record.',
}

const COUNTS: Record<Exclude<SectionKey, 'plans'>, number> = {
  progress: 212, reports: 37, designs: 19, ideas: 41, research: 23, references: 58,
  handoffs: 64, standups: 88, roadmaps: 6, processes: 14, archive: 71,
}

function ideaStatuses(list: Item[]): Status[] {
  return [
    { key: 'new', label: 'New', tone: 'accent', count: list.filter((_, i) => i % 3 === 0).length },
    { key: 'planned', label: 'Planned', tone: 'good', count: list.filter((_, i) => i % 3 === 1).length },
    { key: 'dropped', label: 'Dropped', tone: 'dim', count: list.filter((_, i) => i % 3 === 2).length },
  ]
}

export const SECTIONS: Section[] = (Object.keys(LABEL) as SectionKey[]).map((key, n) => {
  if (key === 'plans') {
    return { key, label: LABEL[key], blurb: BLURB[key], count: planItems.length, newThisWeek: 3, statuses: statusCounts(planItems), weekly: W(1, 5), items: planItems }
  }
  const list = items(GENERIC[key], COUNTS[key])
  return {
    key,
    label: LABEL[key],
    blurb: BLURB[key],
    count: COUNTS[key],
    newThisWeek: Math.round(COUNTS[key] / 20),
    statuses: key === 'ideas' ? ideaStatuses(list) : undefined,
    weekly: W(n + 2, Math.max(1, COUNTS[key] / 14)),
    items: list,
  }
})

export const PRIMARY: SectionKey[] = ['plans', 'progress', 'reports', 'designs', 'ideas', 'research', 'references', 'handoffs']
export const SECONDARY: SectionKey[] = ['standups', 'roadmaps', 'processes', 'archive']

export function section(key: string): Section {
  const s = SECTIONS.find((x) => x.key === key)
  if (!s) throw new Error(`unknown section ${key}`)
  return s
}

export const PROJECTS = [
  { key: 'observeone', label: 'ObserveOne' },
  { key: 'dinar', label: 'Dinar POS' },
  { key: 'personal', label: 'Personal' },
]
