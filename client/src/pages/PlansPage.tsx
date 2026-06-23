import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import type { ContextItem } from '../types'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PlansPageSkeleton } from '../components/Skeleton'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '../components/HoverCard'

const PAGE_SIZE = 10

function PlanRow({ item }: { item: ContextItem }) {
  const fm = item.frontmatter
  const title = (fm?.title as string) || item.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const status = fm?.status as string | undefined
  const prio = fm?.priority as number | undefined
  const tldr = fm?.tldr as string | undefined

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:bg-elevated hover:border-accent/30 transition-all min-w-0">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <span className="text-sm font-medium text-foreground truncate cursor-default flex-1 min-w-0">{title}</span>
        </HoverCardTrigger>
        <HoverCardContent side="right" align="start" className="z-50 w-72 p-4 rounded-lg border border-border bg-elevated shadow-lg">
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
            {tldr && <p className="text-xs text-secondary leading-relaxed">{tldr}</p>}
            {Array.isArray(fm?.tasks) && (
              <div className="text-xs text-secondary">{fm.tasks.length} tasks — {fm.tasks.filter((t: { status?: string }) => t.status === 'done').length} done</div>
            )}
            {fm?.created && <div className="text-[10px] text-secondary">Created: {String(fm.created)}</div>}
          </div>
        </HoverCardContent>
      </HoverCard>
      <div className="flex items-center gap-1.5 shrink-0">
        {prio !== undefined && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
            prio >= 80 ? 'text-red bg-red-bg border-red/20' :
            prio >= 50 ? 'text-amber bg-amber-bg border-amber/20' :
            'text-secondary bg-elevated border-border'
          }`}>P{prio}</span>
        )}
        {status && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
            status === 'active' ? 'text-green bg-green-bg border-green/20' :
            status === 'paused' ? 'text-amber bg-amber-bg border-amber/20' :
            status === 'done' ? 'text-blue bg-blue-bg border-blue/20' :
            status === 'cancelled' ? 'text-red bg-red-bg border-red/20' :
            'text-secondary bg-elevated border-border'
          }`}>{status}</span>
        )}
      </div>
    </div>
  )
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1
  const end = Math.min((page + 1) * PAGE_SIZE, total)
  return (
    <div className="flex items-center justify-between pt-3">
      <span className="text-[11px] text-secondary">{total > 0 ? `${start}–${end} of ${total}` : '0 items'}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 0} className="px-2 py-1 rounded text-xs text-secondary hover:text-foreground hover:bg-elevated disabled:opacity-30 disabled:cursor-default transition-colors">Prev</button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const startPage = Math.max(0, Math.min(page - 2, pages - 5))
          const n = startPage + i
          return <button key={n} onClick={() => onChange(n)} className={`w-7 h-7 rounded text-xs font-medium transition-colors ${n === page ? 'bg-accent text-white' : 'text-secondary hover:text-foreground hover:bg-elevated'}`}>{n + 1}</button>
        })}
        <button onClick={() => onChange(page + 1)} disabled={page >= pages - 1} className="px-2 py-1 rounded text-xs text-secondary hover:text-foreground hover:bg-elevated disabled:opacity-30 disabled:cursor-default transition-colors">Next</button>
      </div>
    </div>
  )
}

export function PlansPage() {
  const navigate = useNavigate()
  const { data: items, isLoading, error } = useFolder('plans')

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'name'>('priority')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!items) return []
    let result = [...items]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) => ((i.frontmatter?.title as string) || i.slug).toLowerCase().includes(q))
    }
    if (filterStatus !== 'all') result = result.filter((i) => (i.frontmatter?.status as string) === filterStatus)

    result.sort((a, b) => {
      if (sortBy === 'priority') return ((b.frontmatter?.priority as number) || 0) - ((a.frontmatter?.priority as number) || 0)
      if (sortBy === 'date') {
        const da = (a.frontmatter?.created as number) || 0
        const db = (b.frontmatter?.created as number) || 0
        return db - da
      }
      const ta = (a.frontmatter?.title as string) || a.slug
      const tb = (b.frontmatter?.title as string) || b.slug
      return ta.localeCompare(tb)
    })
    return result
  }, [items, search, filterStatus, sortBy])

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const allStatuses = useMemo(() => Array.from(new Set(items?.map((i) => i.frontmatter?.status as string).filter(Boolean) ?? [])), [items])

  if (isLoading) return <PlansPageSkeleton />
  if (error) return <div className="text-red text-sm">Error: {(error as Error).message}</div>

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Plans</h1>
        <p className="text-xs text-secondary mt-0.5">{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search plans..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="flex-1 max-w-[260px] px-3 py-1.5 rounded text-xs bg-surface border border-border text-foreground placeholder:text-secondary/50 focus:outline-none focus:border-accent transition-colors"
        />
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(0) }}
          className="px-2 py-1.5 rounded text-xs bg-surface border border-border text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="all">All statuses</option>
          {allStatuses.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value as 'priority' | 'date' | 'name'); setPage(0) }}
          className="px-2 py-1.5 rounded text-xs bg-surface border border-border text-foreground focus:outline-none focus:border-accent transition-colors"
        >
          <option value="priority">By priority</option>
          <option value="date">By date</option>
          <option value="name">By name</option>
        </select>
      </div>

      <div className="space-y-1">
        {paginated.length > 0 ? paginated.map((item) => (
          <button key={item.slug} onClick={() => navigate({ to: '/plan/$slug', params: { slug: item.slug } })} className="w-full text-left">
            <PlanRow item={item} />
          </button>
        )) : (
          <p className="text-secondary text-xs py-12 text-center">No plans found.</p>
        )}
      </div>

      <Pagination page={page} total={filtered.length} onChange={setPage} />
    </div>
  )
}
