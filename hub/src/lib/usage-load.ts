import type { Hub } from '../server/hub'
import type { Store } from '../source/store'
import type { UsageRow } from './usage-types'
import { parseUsageDay } from './usage-types'

/** The newest `days` day files from the store's usage/ folder, flattened to rows. */
export async function loadUsage(store: Store, days = 60): Promise<UsageRow[]> {
  const names = (await store.entries('usage')).slice(0, days).map((e) => e.name)
  if (!names.length) return []
  const files = await store.texts('usage', names)
  return files.flatMap((f) => parseUsageDay(f.text)?.rows ?? []).sort((a, b) => a.date.localeCompare(b.date))
}

/** Usage belongs to no project: read it from whichever configured store holds the collector's files. */
export async function loadHubUsage(hub: Hub, days = 120): Promise<UsageRow[]> {
  for (const p of hub.projects) {
    const store = await hub.store(p.id)
    if (store && (await store.tree('usage'))) return loadUsage(store, days)
  }
  return []
}
