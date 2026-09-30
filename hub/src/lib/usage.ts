import type { UsageRow } from './usage-types'
import { TOOL_LABEL } from './usage-types'

export type GroupBy = 'tool' | 'provider' | 'model'
export type Metric = 'cost' | 'tokens'

// Colour follows the entity: known keys own fixed slots, new ones follow by name,
// so a filter never repaints the survivors. Past eight, keys share the Other colour.
const KNOWN: Record<GroupBy, string[]> = {
  tool: ['claude-code', 'opencode', 'hermes', 'router'],
  provider: ['anthropic', 'opencode', 'opencode-go', 'google', 'openrouter'],
  model: [],
}

export function keysOf(group: GroupBy, rows: UsageRow[]): string[] {
  const present = new Set(rows.map((r) => r[group]))
  const known = KNOWN[group].filter((k) => present.has(k))
  const rest = [...present].filter((k) => !KNOWN[group].includes(k))
  // Models have no fixed list: heaviest first over the whole history, then fixed by that order.
  if (group === 'model') {
    const weight = new Map<string, number>()
    for (const r of rows) weight.set(r.model, (weight.get(r.model) ?? 0) + r.cost * 1e6 + totalTokens(r) + r.calls)
    return rest.sort((a, b) => (weight.get(b) ?? 0) - (weight.get(a) ?? 0) || a.localeCompare(b))
  }
  return [...known, ...rest.sort()]
}

export function slotOf(keys: string[], key: string): string {
  const i = keys.indexOf(key)
  return i >= 0 && i < 8 ? `--series-${i + 1}` : '--series-other'
}

export function labelOf(group: GroupBy, key: string): string {
  if (group === 'tool') return TOOL_LABEL[key as keyof typeof TOOL_LABEL] ?? key
  return key
}

export function totalTokens(r: Pick<UsageRow, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>): number {
  return r.input + r.output + r.cacheRead + r.cacheWrite
}

export function lastDays(rows: UsageRow[], days: number): UsageRow[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const keep = new Set(dates.slice(-days))
  return rows.filter((r) => keep.has(r.date))
}

export function previousDays(rows: UsageRow[], days: number): UsageRow[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const keep = new Set(dates.slice(-days * 2, -days))
  return rows.filter((r) => keep.has(r.date))
}

export interface DayPoint {
  date: string
  [key: string]: number | string
}

/** One point per day, one numeric field per group key. */
export function byDay(rows: UsageRow[], group: GroupBy, metric: Metric): DayPoint[] {
  const map = new Map<string, DayPoint>()
  for (const r of rows) {
    const p = map.get(r.date) ?? { date: r.date }
    const k = r[group]
    const v = metric === 'cost' ? r.cost : totalTokens(r)
    p[k] = ((p[k] as number | undefined) ?? 0) + v
    map.set(r.date, p)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export interface Totals {
  calls: number
  errors: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

export function sum(rows: UsageRow[]): Totals {
  return rows.reduce<Totals>(
    (t, r) => ({
      calls: t.calls + r.calls,
      errors: t.errors + r.errors,
      input: t.input + r.input,
      output: t.output + r.output,
      cacheRead: t.cacheRead + r.cacheRead,
      cacheWrite: t.cacheWrite + r.cacheWrite,
      cost: t.cost + r.cost,
    }),
    { calls: 0, errors: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
  )
}

export interface ModelTotals extends Totals {
  key: string
  tool: UsageRow['tool']
  provider: string
  model: string
  pricing?: UsageRow['pricing']
}

/** One entry per tool, provider and model: a free model often runs under several tools. */
export function byModel(rows: UsageRow[]): ModelTotals[] {
  const map = new Map<string, UsageRow[]>()
  for (const r of rows) {
    const k = `${r.tool}|${r.provider}|${r.model}`
    map.set(k, [...(map.get(k) ?? []), r])
  }
  return [...map.entries()]
    .map(([key, rs]) => ({ ...sum(rs), key, tool: rs[0]!.tool, provider: rs[0]!.provider, model: rs[0]!.model, pricing: rs[0]!.pricing }))
    .sort((a, b) => b.cost - a.cost || totalTokens(b) - totalTokens(a) || b.calls - a.calls)
}

/** The cost cell: 'free', 'no price', or dollars. */
export function priceLabel(m: Pick<ModelTotals, 'cost' | 'pricing'>): string | null {
  if (m.pricing === 'free') return 'free'
  if (m.pricing === 'unpriced' && m.cost === 0) return 'no price'
  return null
}
