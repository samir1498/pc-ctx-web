import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Item, Status } from '../mock/sections'
import { dayLabel } from '../lib/format'

const PAGE = 20
const TONE: Record<Status['tone'], string> = {
  accent: 'text-accent bg-accent-soft',
  good: 'text-good bg-good/10',
  warn: 'text-warn bg-warn/10',
  bad: 'text-bad bg-bad/10',
  dim: 'text-dim bg-hover',
}

// The real list asks the server for one page at a time (useInfiniteQuery); here it slices sample data.
export default function SectionList({ items, statuses, total }: { items: Item[]; statuses?: Status[]; total: number }) {
  const [filter, setFilter] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  const matching = useMemo(
    () => items.filter((i) => (!filter || i.status === filter) && (!q || i.title.toLowerCase().includes(q.toLowerCase()))),
    [items, filter, q],
  )
  const tone = (key?: string) => statuses?.find((s) => s.key === key)
  const page = matching.slice(0, shown)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-border bg-page px-2.5 py-1.5 text-sm">
          <Search className="size-4 text-dim" aria-hidden />
          <span className="sr-only">Filter by title</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} placeholder="Filter by title" className="w-full bg-transparent outline-none placeholder:text-dim" />
        </label>
        {statuses && (
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFilter(null)} className={`rounded-full px-2.5 py-1 text-xs ${filter === null ? 'bg-fg text-page' : 'text-muted hover:bg-hover'}`}>All</button>
            {statuses.map((s) => (
              <button key={s.key} onClick={() => { setFilter(s.key); setShown(PAGE) }} className={`rounded-full px-2.5 py-1 text-xs ${filter === s.key ? 'bg-fg text-page' : 'text-muted hover:bg-hover'}`}>
                {s.label} <span className="num opacity-70">{s.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ul>
        {page.map((i) => {
          const s = tone(i.status)
          return (
            <li key={i.slug} className="border-b border-border last:border-0">
              <a href="#" className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-hover sm:grid-cols-[1fr_auto_5.5rem]">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{i.title}</span>
                  <span className="block truncate text-xs text-dim">{i.summary}</span>
                </span>
                {s ? <span className={`rounded-full px-2 py-0.5 text-xs ${TONE[s.tone]}`}>{s.label}</span> : <span />}
                <span className="num hidden text-right text-xs text-dim sm:block">{dayLabel(i.date)}</span>
              </a>
            </li>
          )
        })}
        {page.length === 0 && <li className="px-4 py-10 text-center text-sm text-dim">Nothing matches.</li>}
      </ul>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-dim">
        <span className="num">
          {page.length} of {filter || q ? matching.length : total}
        </span>
        {shown < matching.length && (
          <button onClick={() => setShown((n) => n + PAGE)} className="rounded-lg border border-border px-3 py-1.5 text-fg hover:bg-hover">
            Load 20 more
          </button>
        )}
      </div>
    </div>
  )
}
