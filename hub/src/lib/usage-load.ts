import type { Hub } from '../server/hub'
import type { Store } from '../source/store'
import type { PlanSample, UsageRow, UsageSession } from './usage-types'
import { parseUsageDay } from './usage-types'

export interface Usage {
  rows: UsageRow[]
  sessions: UsageSession[]
  plan: PlanSample[]
}
const EMPTY: Usage = { rows: [], sessions: [], plan: [] }

/** The newest `days` day files from the store's usage/ folder, flattened and oldest first. */
export async function loadUsage(store: Store, days = 60): Promise<Usage> {
  const names = (await store.entries('usage')).slice(0, days).map((e) => e.name)
  if (!names.length) return EMPTY
  const parsed = (await store.texts('usage', names)).flatMap((f) => parseUsageDay(f.text) ?? [])
  parsed.sort((a, b) => a.date.localeCompare(b.date))
  return { rows: parsed.flatMap((d) => d.rows), sessions: parsed.flatMap((d) => d.sessions), plan: parsed.flatMap((d) => d.plan) }
}

/** Usage belongs to no project: read it from whichever configured store holds the collector's files. */
export async function loadHubUsage(hub: Hub, days = 120): Promise<Usage> {
  for (const p of hub.projects) {
    const store = await hub.store(p.id)
    if (store && (await store.tree('usage'))) return loadUsage(store, days)
  }
  return EMPTY
}
