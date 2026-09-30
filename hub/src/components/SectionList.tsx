import { useEffect, useRef, useState } from 'react'
import { QueryClient, QueryClientProvider, keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import type { ListPage } from '../lib/list'
import type { StatusCount } from '../lib/dashboard'
import { dayLabel } from '../lib/format'

const TONE: Record<StatusCount['tone'], string> = {
  accent: 'text-accent bg-accent-soft',
  good: 'text-good bg-good/10',
  warn: 'text-warn bg-warn/10',
  bad: 'text-bad bg-bad/10',
  dim: 'text-dim bg-hover',
}

interface Props {
  project: string
  section: string
  first: ListPage
  statuses?: { key: string; label: string; tone: StatusCount['tone'] }[]
}

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })

export default function SectionList(props: Props) {
  return (
    <QueryClientProvider client={client}>
      <List {...props} />
    </QueryClientProvider>
  )
}

function List({ project, section, first, statuses }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const unfiltered = !status && !q
  const query = useInfiniteQuery({
    queryKey: ['section', project, section, status, q],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<ListPage> => {
      const params = new URLSearchParams({ page: String(pageParam) })
      if (status) params.set('status', status)
      if (q) params.set('q', q)
      const res = await fetch(`/api/p/${encodeURIComponent(project)}/${section}?${params}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
      return res.json()
    },
    // Count what arrived rather than assume the server's page size.
    getNextPageParam: (last, all) => (all.reduce((n, p) => n + p.items.length, 0) < last.total && last.items.length > 0 ? last.page + 1 : undefined),
    // The server already rendered page 0 of the unfiltered list.
    initialData: unfiltered ? { pages: [first], pageParams: [0] } : undefined,
    placeholderData: keepPreviousData,
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  const tone = (key?: string) => statuses?.find((s) => s.key === key)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-lg border border-border bg-page px-2.5 py-1.5 text-sm">
          <Search className="size-4 text-dim" aria-hidden />
          <span className="sr-only">Filter by title</span>
          <input
            value={typed}
            onChange={(e) => {
              const v = e.target.value
              setTyped(v)
              clearTimeout(timer.current)
              timer.current = setTimeout(() => setQ(v.trim()), 250)
            }}
            placeholder="Filter by title"
            className="w-full bg-transparent outline-none placeholder:text-dim"
          />
        </label>
        {statuses && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Status">
            {[{ key: null, label: 'All' }, ...statuses].map((s) => (
              <button
                key={s.key ?? 'all'}
                aria-pressed={status === s.key}
                onClick={() => setStatus(s.key)}
                className={`rounded-full px-2.5 py-1 text-xs ${status === s.key ? 'bg-fg text-page' : 'text-muted hover:bg-hover'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className={query.isPlaceholderData ? 'opacity-60' : ''}>
        {items.map((i) => {
          const s = tone(i.status)
          return (
            <li key={i.slug} className="border-b border-border last:border-0">
              <a href={i.href} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-hover sm:grid-cols-[1fr_auto_5.5rem]">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-fg">{i.title}</span>
                  {i.summary && <span className="block truncate text-xs text-dim">{i.summary}</span>}
                </span>
                <span className="flex items-center gap-2">
                  {i.progress && (
                    <span className="num hidden text-xs text-dim md:inline">
                      {i.progress.done}/{i.progress.total}
                    </span>
                  )}
                  {s ? <span className={`rounded-full px-2 py-0.5 text-xs ${TONE[s.tone]}`}>{s.label}</span> : i.status ? <span className="text-xs text-dim">{i.status}</span> : null}
                </span>
                <span className="num hidden text-right text-xs text-dim sm:block">{i.date ? dayLabel(i.date) : ''}</span>
              </a>
            </li>
          )
        })}
        {query.isError && <li className="px-4 py-6 text-sm text-bad">Could not load this list: {query.error.message}</li>}
        {!query.isError && !query.isFetching && items.length === 0 && <li className="px-4 py-10 text-center text-sm text-dim">Nothing matches.</li>}
      </ul>
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-dim">
        <span className="num">
          {items.length} of {total}
        </span>
        {query.hasNextPage && (
          <button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="rounded-lg border border-border px-3 py-1.5 text-fg hover:bg-hover disabled:opacity-50">
            {query.isFetchingNextPage ? 'Loading' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
