// One file per day in the store's usage/ folder, written by pc-ctx-web collector/usage_collect.py.
// Counts, model names, tool and date only: never prompt text.

export type Tool = 'claude-code' | 'opencode' | 'hermes' | 'router'
export type Pricing = 'list' | 'reported' | 'free' | 'unpriced'

export interface UsageRow {
  date: string // YYYY-MM-DD
  tool: Tool
  provider: string
  model: string
  calls: number
  errors: number // failed calls; they carry no tokens
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number // USD: list price, or the tool's own figure when 'reported'; 0 when free or unpriced
  pricing?: Pricing
}

export interface UsageDay {
  date: string
  rows: UsageRow[]
}

export const TOOL_LABEL: Record<Tool, string> = {
  'claude-code': 'Claude Code',
  opencode: 'opencode',
  hermes: 'Hermes',
  router: 'Other router clients',
}

const PRICINGS = new Set<string>(['list', 'reported', 'free', 'unpriced'])

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const TOOLS = new Set<string>(Object.keys(TOOL_LABEL))

/** Parses one day file; anything malformed is dropped rather than drawn. */
export function parseUsageDay(text: string): UsageDay | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const { date, rows } = raw as { date?: unknown; rows?: unknown }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(rows)) return null
  const out: UsageRow[] = []
  for (const r of rows) {
    if (typeof r !== 'object' || r === null) continue
    const x = r as Record<string, unknown>
    if (typeof x.tool !== 'string' || !TOOLS.has(x.tool) || typeof x.model !== 'string') continue
    out.push({
      date,
      tool: x.tool as Tool,
      provider: typeof x.provider === 'string' ? x.provider : 'unknown',
      model: x.model,
      calls: num(x.calls),
      errors: num(x.errors),
      input: num(x.input),
      output: num(x.output),
      cacheRead: num(x.cacheRead),
      cacheWrite: num(x.cacheWrite),
      cost: num(x.cost),
      pricing: typeof x.pricing === 'string' && PRICINGS.has(x.pricing) ? (x.pricing as Pricing) : 'list',
    })
  }
  return { date, rows: out }
}
