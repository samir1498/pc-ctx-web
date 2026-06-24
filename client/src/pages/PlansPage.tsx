import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import { PageHeader } from '../components/PageHeader'
import { PlansPageSkeleton } from '../components/Skeleton'
import { statusColor, priorityColor, taskCounts } from '../lib/ui'

const FILTERS = ['all', 'active', 'paused', 'done', 'cancelled'] as const

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

  if (isLoading) return <div className="px-10 py-6"><PlansPageSkeleton /></div>
  if (error) return <div className="px-10 py-6 text-sm text-red">Error: {(error as Error).message}</div>

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
