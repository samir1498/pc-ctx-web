import { describe, expect, it } from 'vitest'
import type { ContextItem } from '../types'
import { docDate, docTitle, shortDate, splitLeadingHeading, titleFromSlug } from './hub'
import { buildSidebar, currentItem, parseHubPath } from './nav'

// A fixture store the size of the real ones' shape: two live plans, a paused
// one, one report, two standups, a roadmap, and a few handoffs.
const plans: ContextItem[] = [
  { slug: '20260927-finish-the-shop', name: '20260927-finish-the-shop.md', path: 'plans/20260927-finish-the-shop.md', frontmatter: { title: 'Finish the shop', status: 'active' } },
  { slug: '20260910-till', name: '20260910-till.md', path: 'plans/20260910-till.md', frontmatter: { title: 'The till', status: 'active' } },
  { slug: '20260901-printer', name: '20260901-printer.md', path: 'plans/20260901-printer.md', frontmatter: { title: 'The printer run', status: 'paused' } },
  { slug: '20260820-money', name: '20260820-money.md', path: 'plans/20260820-money.md', frontmatter: { title: 'Money core', status: 'done' } },
]
const reports: ContextItem[] = [
  { slug: '2026-09-10-m2-checkpoint', name: '2026-09-10-m2-checkpoint.md', path: 'reports/2026-09-10-m2-checkpoint.md', frontmatter: { title: 'M2 checkpoint', date: '2026-09-10' } },
]
const standups: ContextItem[] = [
  { slug: '2026-09-22', name: '2026-09-22.md', path: 'progress/standup/2026-09-22.md', frontmatter: { type: 'daily' } },
  { slug: '2026-08-22', name: '2026-08-22.md', path: 'progress/standup/2026-08-22.md', frontmatter: { type: 'daily' } },
]
const roadmaps: ContextItem[] = [
  { slug: 'dz-pos-to-first-shop', name: 'dz-pos-to-first-shop.md', path: 'roadmaps/dz-pos-to-first-shop.md', frontmatter: { title: 'dz-pos to first shop' } },
]
const counts = { plans: 4, reports: 1, standups: 2, roadmaps: 1, handoffs: 2, processes: 6, loops: 15, research: 0 }

function build(path: string, extra: Partial<Parameters<typeof buildSidebar>[0]> = {}) {
  return buildSidebar({ project: 'dinar', path, counts, plans, reports, standups, roadmaps, ...extra })
}

const flat = (groups: ReturnType<typeof build>) => groups.flatMap((g) => g.items)

describe('buildSidebar', () => {
  it('lists a plan, a report and a standup for the fixture store, each linking into the project', () => {
    const items = flat(build('/p/dinar'))
    expect(items).toContainEqual(expect.objectContaining({ label: 'Finish the shop', to: '/p/dinar/plan/20260927-finish-the-shop' }))
    expect(items).toContainEqual(expect.objectContaining({ label: 'M2 checkpoint', to: '/p/dinar/reports/2026-09-10-m2-checkpoint' }))
    expect(items).toContainEqual(expect.objectContaining({ label: 'Standup, 22 Sep', to: '/p/dinar/standups/2026-09-22' }))
  })

  it('groups plans by status: in progress, waiting, done', () => {
    const groups = build('/p/dinar')
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.label)]))
    expect(byKey['plans-active']).toEqual(['Finish the shop', 'The till'])
    expect(byKey['plans-paused']).toEqual(['The printer run'])
    expect(byKey['plans-done']).toEqual(['Money core'])
  })

  it('marks the overview current on the project home and nothing else', () => {
    const groups = build('/p/dinar/')
    const current = flat(groups).filter((i) => i.current)
    expect(current.map((i) => i.label)).toEqual(['Overview'])
  })

  it('keeps the sidebar on a plan page with that plan marked current', () => {
    const groups = build('/p/dinar/plan/20260910-till')
    expect(groups.map((g) => g.key)).toEqual(['start', 'plans-active', 'plans-paused', 'plans-done', 'reports', 'standups', 'roadmaps', 'library'])
    expect(currentItem(groups)).toEqual(expect.objectContaining({ label: 'The till', to: '/p/dinar/plan/20260910-till' }))
    expect(flat(groups).filter((i) => i.current)).toHaveLength(1)
  })

  it('marks a standup current on its own page and expands the standups list there', () => {
    const groups = build('/p/dinar/standups/2026-08-22')
    const cur = currentItem(groups)
    expect(cur?.to).toBe('/p/dinar/standups/2026-08-22')
    expect(groups.find((g) => g.key === 'standups')?.items.map((i) => i.label)).toEqual(['Standup, 22 Sep', 'Standup, 22 Aug', 'All 2 standups'])
  })

  it('hides empty domains instead of saying "none yet"', () => {
    const groups = build('/p/dinar', { reports: [], standups: [], counts: { ...counts, reports: 0, standups: 0, research: 0 } })
    const keys = groups.map((g) => g.key)
    expect(keys).not.toContain('reports')
    expect(keys).not.toContain('standups')
    const library = groups.find((g) => g.key === 'library')
    expect(library?.items.map((i) => i.label)).toEqual(['Handoffs', 'Processes', 'Loops'])
    expect(library?.items.map((i) => i.meta)).toEqual(['2', '6', '15'])
  })

  it('caps a long group and points the rest at the board', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      slug: `p${i}`,
      name: `p${i}.md`,
      path: `plans/p${i}.md`,
      frontmatter: { title: `Plan ${i}`, status: 'active' },
    }))
    const groups = build('/p/dinar/plan/p25', { plans: many })
    const active = groups.find((g) => g.key === 'plans-active')
    expect(active?.items).toHaveLength(9)
    expect(active?.items.at(-1)).toEqual(expect.objectContaining({ label: '22 more', to: '/p/dinar/plans', muted: true }))
    // The plan being read stays visible even past the cap.
    expect(active?.items.some((i) => i.current && i.label === 'Plan 25')).toBe(true)
  })

  it('opens the current library folder under its row', () => {
    const groups = build('/p/dinar/handoffs/20260922-the-restructure-loop', {
      folderItems: {
        folder: 'handoffs',
        items: [
          { slug: '20260922-the-restructure-loop', name: 'a.md', path: 'handoffs/a.md' },
          { slug: '20260916-16-sep-morning', name: 'b.md', path: 'handoffs/b.md' },
        ],
      },
    })
    const open = groups.find((g) => g.key === 'in-handoffs')
    expect(open?.items.map((i) => i.label)).toEqual(['The restructure loop', '16 sep morning'])
    expect(open?.items[0]?.current).toBe(true)
  })

  it('rewrites labels for the plain audience through the given function', () => {
    const groups = build('/p/dinar', { label: (t) => t.replace(/M2 /, '') })
    expect(flat(groups).some((i) => i.label === 'checkpoint')).toBe(true)
  })

  it('keeps the original title when the rewrite would leave a blank row', () => {
    const groups = build('/p/dinar', { label: (t) => (t.includes('till') ? '' : t) })
    expect(flat(groups).some((i) => i.label === 'The till')).toBe(true)
    expect(flat(groups).every((i) => i.label.trim() !== '')).toBe(true)
  })
})

describe('parseHubPath', () => {
  it('reads project, folder and slug', () => {
    expect(parseHubPath('/p/dinar')).toEqual({ project: 'dinar', folder: null, slug: null })
    expect(parseHubPath('/p/dinar/plan/x')).toEqual({ project: 'dinar', folder: 'plan', slug: 'x' })
    expect(parseHubPath('/p/dinar/reports/y')).toEqual({ project: 'dinar', folder: 'reports', slug: 'y' })
    expect(parseHubPath('/settings')).toBeNull()
  })
})

describe('document titles and dates', () => {
  it('titles a file from its slug when it has no frontmatter', () => {
    expect(titleFromSlug('20260927-finish-the-shop-before-the-break')).toBe('Finish the shop before the break')
    expect(titleFromSlug('2026-09-22')).toBe('2026-09-22')
    expect(titleFromSlug('now')).toBe('Now')
  })

  it('prefers frontmatter, then the first heading, then the slug', () => {
    expect(docTitle({ slug: 'x', frontmatter: { title: 'From frontmatter' }, body: '# Heading' })).toBe('From frontmatter')
    expect(docTitle({ slug: 'x', body: '# Standup, 22 September\n\ntext' })).toBe('Standup, 22 September')
    expect(docTitle({ slug: '2026-04-19-cli-handoff' })).toBe('Cli handoff')
  })

  it('splits a leading heading off the body so it is not shown twice', () => {
    expect(splitLeadingHeading('# Title\n\nBody here')).toEqual({ heading: 'Title', rest: 'Body here' })
    expect(splitLeadingHeading('Body only')).toEqual({ heading: null, rest: 'Body only' })
  })

  it('finds a date in frontmatter (created as YYYYMMDD, date as ISO) or the file name', () => {
    expect(docDate({ slug: 'x', frontmatter: { created: 20260908 } })).toBe('2026-09-08')
    expect(docDate({ slug: 'x', frontmatter: { date: '2026-09-21T00:00:00.000Z' } })).toBe('2026-09-21')
    expect(docDate({ slug: '2026-03-15-full-cli-audit-report' })).toBe('2026-03-15')
    expect(docDate({ slug: 'now' })).toBeNull()
    expect(shortDate('2026-09-22', new Date(2026, 8, 28))).toBe('22 Sep')
    expect(shortDate('2025-12-01', new Date(2026, 8, 28))).toBe('1 Dec 2025')
  })
})
