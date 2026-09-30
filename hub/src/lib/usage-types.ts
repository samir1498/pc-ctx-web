// One file per day in the store's usage/ folder, written by pc-ctx-web collector/usage_collect.py.
// Counts, model names, tool, host and date; sessions add the desktop app's own session titles.

export type Tool = 'claude-code' | 'claude-desktop' | 'cowork' | 'claude-sdk' | 'opencode' | 'hermes' | 'router'
export type Host = 'wsl' | 'windows'
export type Pricing = 'list' | 'reported' | 'free' | 'unpriced'

export interface UsageRow {
  date: string // YYYY-MM-DD
  host: Host
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

/** One Claude session's share of one day. */
export interface UsageSession {
  date: string
  id: string
  host: Host
  tool: Tool
  title?: string
  task?: string // scheduled task id
  project?: string
  pr?: string
  models: string[]
  calls: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number // list price
}

/** The desktop app's sample of plan quota used, in percent. */
export interface PlanSample {
  at: string // YYYY-MM-DDTHH:MM, Berlin
  fiveHour: number | null
  sevenDay: number | null
}

export interface UsageDay {
  date: string
  rows: UsageRow[]
  sessions: UsageSession[]
  plan: PlanSample[]
}

export const TOOL_LABEL: Record<Tool, string> = {
  'claude-code': 'Claude Code',
  'claude-desktop': 'Claude desktop (Code)',
  cowork: 'Cowork',
  'claude-sdk': 'Claude Agent SDK',
  opencode: 'opencode',
  hermes: 'Hermes',
  router: 'Other router clients',
}

export const HOST_LABEL: Record<Host, string> = { wsl: 'WSL', windows: 'Windows' }

const PRICINGS = new Set<string>(['list', 'reported', 'free', 'unpriced'])

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const TOOLS = new Set<string>(Object.keys(TOOL_LABEL))
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
const hostOf = (v: unknown): Host => (v === 'windows' ? 'windows' : 'wsl')
const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Parses one day file; anything malformed is dropped rather than drawn. */
export function parseUsageDay(text: string): UsageDay | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const { date, rows, sessions, plan } = raw as { date?: unknown; rows?: unknown; sessions?: unknown; plan?: unknown }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(rows)) return null
  const out: UsageRow[] = []
  for (const r of rows) {
    if (typeof r !== 'object' || r === null) continue
    const x = r as Record<string, unknown>
    if (typeof x.tool !== 'string' || !TOOLS.has(x.tool) || typeof x.model !== 'string') continue
    out.push({
      date,
      host: hostOf(x.host),
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
  const ses: UsageSession[] = []
  for (const r of Array.isArray(sessions) ? sessions : []) {
    if (typeof r !== 'object' || r === null) continue
    const x = r as Record<string, unknown>
    if (typeof x.id !== 'string' || typeof x.tool !== 'string' || !TOOLS.has(x.tool)) continue
    ses.push({
      date,
      id: x.id,
      host: hostOf(x.host),
      tool: x.tool as Tool,
      title: str(x.title),
      task: str(x.task),
      project: str(x.project),
      pr: str(x.pr),
      models: Array.isArray(x.models) ? x.models.filter((m): m is string => typeof m === 'string') : [],
      calls: num(x.calls),
      input: num(x.input),
      output: num(x.output),
      cacheRead: num(x.cacheRead),
      cacheWrite: num(x.cacheWrite),
      cost: num(x.cost),
    })
  }
  const samples: PlanSample[] = []
  for (const r of Array.isArray(plan) ? plan : []) {
    const x = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>
    if (typeof x.at !== 'string' || !/^\d{2}:\d{2}$/.test(x.at)) continue
    samples.push({ at: `${date}T${x.at}`, fiveHour: pct(x.fiveHour), sevenDay: pct(x.sevenDay) })
  }
  return { date, rows: out, sessions: ses, plan: samples }
}
