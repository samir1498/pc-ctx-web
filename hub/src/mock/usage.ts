// Sample data for the mockups, shaped like the per-day files the collector will write.
// Field names follow the sources on the box: Claude Code message.usage, opencode
// message.data.tokens, Hermes session_model_usage.

export type Tool = 'claude-code' | 'opencode' | 'hermes'

export interface UsageRow {
  date: string // YYYY-MM-DD
  tool: Tool
  provider: string
  model: string
  calls: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number // USD, API-equivalent at list prices; 0 for free models
}

export const TOOL_LABEL: Record<Tool, string> = {
  'claude-code': 'Claude Code',
  opencode: 'opencode',
  hermes: 'Hermes',
}

// Placeholder list prices, USD per million tokens. The real table lives in one file.
const PRICE: Record<string, { in: number; out: number; cr: number; cw: number }> = {
  'claude-opus-5-5': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-sonnet-5-5': { in: 3, out: 15, cr: 0.3, cw: 3.75 },
  'claude-haiku-4-5': { in: 1, out: 5, cr: 0.1, cw: 1.25 },
  'glm-5.1': { in: 0.6, out: 2.2, cr: 0.11, cw: 0 },
}

interface Profile {
  tool: Tool
  provider: string
  model: string
  calls: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  weekendDip: number
  since?: number // day index the model first appears
}

const PROFILES: Profile[] = [
  { tool: 'claude-code', provider: 'anthropic', model: 'claude-opus-5-5', calls: 1400, input: 1.6e6, output: 1.1e6, cacheRead: 118e6, cacheWrite: 6.2e6, weekendDip: 0.35 },
  { tool: 'claude-code', provider: 'anthropic', model: 'claude-sonnet-5-5', calls: 520, input: 0.7e6, output: 0.38e6, cacheRead: 31e6, cacheWrite: 2.1e6, weekendDip: 0.3 },
  { tool: 'claude-code', provider: 'anthropic', model: 'claude-haiku-4-5', calls: 380, input: 0.9e6, output: 0.12e6, cacheRead: 6e6, cacheWrite: 0.6e6, weekendDip: 0.4 },
  { tool: 'opencode', provider: 'zai', model: 'glm-5.1', calls: 310, input: 0.8e6, output: 0.21e6, cacheRead: 9e6, cacheWrite: 0, weekendDip: 0.5, since: 6 },
  // opencode free models report zero tokens; only the call count is real.
  { tool: 'opencode', provider: 'opencode-go', model: 'space-bunny-free', calls: 240, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, weekendDip: 0.6 },
  { tool: 'opencode', provider: 'opencode-go', model: 'longcat-2.5-preview-free', calls: 90, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, weekendDip: 0.6, since: 12 },
  // Hermes goes through the local router; "cheap" is the router's alias.
  { tool: 'hermes', provider: 'router', model: 'cheap', calls: 60, input: 0.42e6, output: 0.02e6, cacheRead: 1.1e6, cacheWrite: 0, weekendDip: 0.9 },
]

// Deterministic noise so every build shows the same mockup.
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const DAYS = 30
const END = new Date('2026-09-30T00:00:00Z')

function build(): UsageRow[] {
  const rows: UsageRow[] = []
  for (let d = 0; d < DAYS; d++) {
    const day = new Date(END.getTime() - (DAYS - 1 - d) * 864e5)
    const date = day.toISOString().slice(0, 10)
    const dow = day.getUTCDay()
    const weekend = dow === 0 || dow === 6
    PROFILES.forEach((p, i) => {
      if (p.since !== undefined && d < p.since) return
      const trend = 0.75 + (d / DAYS) * 0.5
      const f = trend * (weekend ? p.weekendDip : 1) * (0.6 + noise(d * 31 + i * 7) * 0.8)
      const r = {
        date,
        tool: p.tool,
        provider: p.provider,
        model: p.model,
        calls: Math.round(p.calls * f),
        input: Math.round(p.input * f),
        output: Math.round(p.output * f),
        cacheRead: Math.round(p.cacheRead * f),
        cacheWrite: Math.round(p.cacheWrite * f),
        cost: 0,
      }
      const price = PRICE[p.model]
      if (price) {
        r.cost = (r.input * price.in + r.output * price.out + r.cacheRead * price.cr + r.cacheWrite * price.cw) / 1e6
      }
      rows.push(r)
    })
  }
  return rows
}

export const USAGE: UsageRow[] = build()
