import type { UsageRow } from '../mock/usage'
import { TOOL_LABEL } from '../mock/usage'

export type GroupBy = 'tool' | 'provider' | 'model'
export type Metric = 'cost' | 'tokens'

// Colour follows the entity: each key owns a fixed slot, so filters never repaint.
const SLOTS: Record<GroupBy, string[]> = {
  tool: ['claude-code', 'opencode', 'hermes'],
  provider: ['anthropic', 'zai', 'opencode-go', 'router'],
  model: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5', 'glm-5.1', 'space-bunny-free', 'longcat-2.5-preview-free', 'cheap'],
}

export function slotOf(group: GroupBy, key: string): string {
  const i = SLOTS[group].indexOf(key)
  return i >= 0 && i < 8 ? `--series-${i + 1}` : '--series-other'
}

export function keysOf(group: GroupBy): string[] {
  return SLOTS[group]
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
      input: t.input + r.input,
      output: t.output + r.output,
      cacheRead: t.cacheRead + r.cacheRead,
      cacheWrite: t.cacheWrite + r.cacheWrite,
      cost: t.cost + r.cost,
    }),
    { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
  )
}

export interface ModelTotals extends Totals {
  tool: UsageRow['tool']
  provider: string
  model: string
}

export function byModel(rows: UsageRow[]): ModelTotals[] {
  const map = new Map<string, UsageRow[]>()
  for (const r of rows) map.set(r.model, [...(map.get(r.model) ?? []), r])
  return [...map.entries()]
    .map(([model, rs]) => ({ ...sum(rs), tool: rs[0]!.tool, provider: rs[0]!.provider, model }))
    .sort((a, b) => b.cost - a.cost || totalTokens(b) - totalTokens(a) || b.calls - a.calls)
}
