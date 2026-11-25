import { isRecord } from '../source/folders'

/** What the Overview generator (collector/overview.py) writes, read defensively like usage-types. */
export const KINDS = ['version', 'feature', 'install', 'customer', 'contacts'] as const
export type Kind = (typeof KINDS)[number]

export const KIND_LABEL: Record<Kind, string> = { version: 'Version', feature: 'Feature', install: 'Install', customer: 'Customer', contacts: 'Contacts' }

export interface DotLink {
  label: string
  href: string
}
export interface DotCross {
  product: string
  id: string
  date: string
  title: string
}
export interface Dot {
  id: string
  date: string
  kind: Kind
  title: string
  detail: string
  links: DotLink[]
  cross: DotCross[]
}
export interface Product {
  id: string
  name: string
  tagline: string
  latest: string
  customers: number
  dots: Dot[]
}
export interface StripDot {
  id: string
  date: string
  kind: Kind
}
export interface ProductSummary {
  id: string
  name: string
  tagline: string
  latest: string
  customers: number
  dots: number
  contactWeeks: number
  first: string
  kinds: Record<Kind, number>
  strip: StripDot[]
}
export type LoopState = 'running' | 'scheduled' | 'quiet' | 'stale' | 'paused' | 'done'
export const LOOP_STATES: readonly LoopState[] = ['running', 'scheduled', 'quiet', 'stale', 'paused', 'done']
export interface Loop {
  id: string
  name: string
  owner: 'ours' | 'owner'
  what: string
  last: string
  link: string
  state: LoopState
}
export interface DocRef {
  slug: string
  title: string
  note: string
}
export interface Overview {
  generated: string
  products: ProductSummary[]
  loops: Loop[]
  folded: string[]
  docs: DocRef[]
  generatedAt: string
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
export const isKind = (v: unknown): v is Kind => KINDS.some((k) => k === v)
const isState = (v: unknown): v is LoopState => LOOP_STATES.some((s) => s === v)

function parseDot(v: unknown): Dot | null {
  if (!isRecord(v) || !isKind(v.kind) || !str(v.id)) return null
  return {
    id: str(v.id),
    date: str(v.date),
    kind: v.kind,
    title: str(v.title),
    detail: str(v.detail),
    links: list(v.links).flatMap((l) => (isRecord(l) && str(l.href) ? [{ label: str(l.label) || str(l.href), href: str(l.href) }] : [])),
    cross: list(v.cross).flatMap((c) => (isRecord(c) && str(c.product) && str(c.id) ? [{ product: str(c.product), id: str(c.id), date: str(c.date), title: str(c.title) }] : [])),
  }
}

export function parseProduct(text: string): Product | null {
  const v: unknown = JSON.parse(text)
  if (!isRecord(v) || !str(v.id)) return null
  return {
    id: str(v.id),
    name: str(v.name),
    tagline: str(v.tagline),
    latest: str(v.latest),
    customers: isRecord(v.customers) ? num(v.customers.count) : 0,
    dots: list(v.dots).flatMap((d) => parseDot(d) ?? []),
  }
}

function parseSummary(v: unknown): ProductSummary | null {
  if (!isRecord(v) || !str(v.id)) return null
  const kinds = isRecord(v.kinds) ? v.kinds : {}
  return {
    id: str(v.id),
    name: str(v.name),
    tagline: str(v.tagline),
    latest: str(v.latest),
    customers: num(v.customers),
    dots: num(v.dots),
    contactWeeks: num(v.contactWeeks),
    first: str(v.first),
    kinds: { version: num(kinds.version), feature: num(kinds.feature), install: num(kinds.install), customer: num(kinds.customer), contacts: num(kinds.contacts) },
    strip: list(v.strip).flatMap((d) => (isRecord(d) && isKind(d.kind) && str(d.id) ? [{ id: str(d.id), date: str(d.date), kind: d.kind }] : [])),
  }
}

export function parseOverview(indexText: string, loopsText: string): Overview {
  const index: unknown = JSON.parse(indexText)
  const loops: unknown = loopsText ? JSON.parse(loopsText) : {}
  const idx = isRecord(index) ? index : {}
  const lp = isRecord(loops) ? loops : {}
  return {
    generated: str(idx.generated),
    generatedAt: str(lp.generated) || str(idx.generated),
    products: list(idx.products).flatMap((p) => parseSummary(p) ?? []),
    docs: list(idx.docs).flatMap((d) => (isRecord(d) && str(d.slug) ? [{ slug: str(d.slug), title: str(d.title) || str(d.slug), note: str(d.note) }] : [])),
    loops: list(lp.loops).flatMap((l) =>
      isRecord(l) && isState(l.state) && str(l.name)
        ? [{ id: str(l.id), name: str(l.name), owner: l.owner === 'owner' ? ('owner' as const) : ('ours' as const), what: str(l.what), last: str(l.last), link: str(l.link), state: l.state }]
        : [],
    ),
    folded: list(lp.folded).flatMap((f) => (isRecord(f) && str(f.text) ? [str(f.text)] : [])),
  }
}

/** The kind a dot id names: `<product>-<yyyymmdd>-<kind>-<n>`. */
export function kindOfId(id: string): Kind {
  const k = id.split('-')[2]
  return isKind(k) ? k : 'feature'
}

export function kindCounts(dots: { kind: Kind }[]): Record<Kind, number> {
  const n = (k: Kind) => dots.filter((d) => d.kind === k).length
  return { version: n('version'), feature: n('feature'), install: n('install'), customer: n('customer'), contacts: n('contacts') }
}
