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
