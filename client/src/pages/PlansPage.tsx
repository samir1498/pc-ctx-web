import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
<<<<<<< HEAD
import { PageHeader } from '../components/PageHeader'
=======
import type { ContextItem } from '../types'
>>>>>>> origin/main
import { PlansPageSkeleton } from '../components/Skeleton'
import { statusColor, priorityColor, taskCounts } from '../lib/ui'

<<<<<<< HEAD
const FILTERS = ['all', 'active', 'paused', 'done', 'cancelled'] as const
=======
const PAGE_SIZE = 10

function PlanRow({ item }: { item: ContextItem }) {
  const fm = item.frontmatter
  const title = fm?.title || item.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const status = fm?.status
  const prio = fm?.priority
  const tldr = fm?.tldr

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
              <div className="text-xs text-secondary">{fm.tasks.length} tasks - {fm.tasks.filter((t) => t.status === 'done').length} done</div>
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
>>>>>>> origin/main

export function PlansPage() {
  const navigate = useNavigate()
  const { data: items, isLoading, error } = useFolder('plans')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')

  const rows = useMemo(() => {
    const q = query.toLowerCase()
    return [...(items ?? [])]
      .sort((a, b) => (b.frontmatter?.priority ?? 0) - (a.frontmatter?.priority ?? 0))
      .filter((p) => filter === 'all' || p.frontmatter?.status === filter)
      .filter((p) => {
        if (!q) return true
        const fm = p.frontmatter ?? {}
        return `${fm.title ?? p.slug}${fm.tldr ?? ''}${fm.category ?? ''}`.toLowerCase().includes(q)
      })
  }, [items, query, filter])

<<<<<<< HEAD
  if (isLoading) return <div className="px-10 py-6"><PlansPageSkeleton /></div>
  if (error) return <div className="px-10 py-6 text-sm text-red">Error: {(error as Error).message}</div>
=======
  const filtered = useMemo(() => {
    if (!items) return []
    let result = [...items]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) => (i.frontmatter?.title || i.slug).toLowerCase().includes(q))
    }
    if (filterStatus !== 'all') result = result.filter((i) => i.frontmatter?.status === filterStatus)

    result.sort((a, b) => {
      if (sortBy === 'priority') return (b.frontmatter?.priority || 0) - (a.frontmatter?.priority || 0)
      if (sortBy === 'date') {
        const da = new Date(a.frontmatter?.created ?? 0).getTime()
        const db = new Date(b.frontmatter?.created ?? 0).getTime()
        return db - da
      }
      const ta = a.frontmatter?.title || a.slug
      const tb = b.frontmatter?.title || b.slug
      return ta.localeCompare(tb)
    })
    return result
  }, [items, search, filterStatus, sortBy])

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const allStatuses = useMemo(() => Array.from(new Set(items?.map((i) => i.frontmatter?.status).filter((s): s is string => Boolean(s)) ?? [])), [items])

  if (isLoading) return <PlansPageSkeleton />
  if (error) return <div className="text-red text-sm">Error: {(error as Error).message}</div>
>>>>>>> origin/main

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="DOMAIN / PLANS"
        title="Plans"
        subtitle={<><span className="text-foreground">{rows.length}</span> shown · sorted by priority</>}
      />

      {/* controls */}
      <div className="flex flex-wrap items-center gap-3.5 border-b border-border px-10 py-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search plans…"
          className="w-60 border border-line bg-input px-3 py-2 font-mono text-xs text-foreground placeholder:text-faint focus:border-[#3a3a40] focus:outline-none"
        />
        <div className="flex gap-1.5">
          {FILTERS.map((f) => {
            const on = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="border border-[#1f1f24] px-2.5 py-[7px] font-mono text-[10.5px] tracking-[0.06em]"
                style={{ color: on ? '#f3f2ee' : '#7d7d84', fontWeight: on ? 600 : 400 }}
              >
                {on ? '▍ ' : ''}
                {f.toUpperCase()}
              </button>
            )
          })}
        </div>
      </div>

      {/* table */}
      <div className="px-10">
        <div className="grid grid-cols-[56px_1fr_130px_90px_110px] gap-4 border-b border-border py-2.5 pt-4 font-mono text-[10px] tracking-[0.08em] text-faint">
          <span>PRIO</span>
          <span>PLAN</span>
          <span>CATEGORY</span>
          <span>TASKS</span>
          <span>STATUS</span>
        </div>
        {rows.map((p) => {
          const fm = p.frontmatter ?? {}
          const tc = taskCounts(p)
          return (
            <button
              key={p.slug}
              onClick={() => navigate({ to: '/plan/$slug', params: { slug: p.slug } })}
              className="v2row grid w-full cursor-pointer grid-cols-[56px_1fr_130px_90px_110px] items-center gap-4 border-b border-[#141417] py-[15px] text-left"
            >
              <span className="font-mono text-[13px] font-semibold" style={{ color: priorityColor(fm.priority) }}>
                P{fm.priority ?? '—'}
              </span>
              <div className="min-w-0">
                <div className="text-[14.5px] font-medium tracking-[-0.01em]">{fm.title ?? p.slug}</div>
                {fm.tldr && <div className="mt-0.5 truncate font-mono text-[11px] text-dim">{fm.tldr}</div>}
              </div>
              <span className="truncate font-mono text-[11px] text-muted">{fm.category ?? '—'}</span>
              <span className="font-mono text-xs text-secondary">{tc ? `${tc.done}/${tc.total}` : '—'}</span>
              <span className="font-mono text-[11px]" style={{ color: statusColor(fm.status) }}>
                [{fm.status ?? '—'}]
              </span>
            </button>
          )
        })}
        {rows.length === 0 && <p className="py-12 text-center font-mono text-xs text-faint">no plans found</p>}
      </div>
      <div className="h-8" />
    </div>
  )
}
