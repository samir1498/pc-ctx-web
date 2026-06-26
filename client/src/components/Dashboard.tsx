import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import type { ContextItem } from '../types'
import { DashboardSkeleton } from './Skeleton'
import { statusColor, priorityColor, parseCreated, isoWeek, weeklyActivity } from '../lib/ui'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function latestDate(items: (ContextItem[] | undefined)[]): Date | null {
  let max: Date | null = null
  for (const list of items) {
    for (const it of list ?? []) {
      const d = parseCreated(it.frontmatter?.created)
      if (d && (!max || d > max)) max = d
    }
  }
  return max
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] tracking-[0.12em] text-dim">{children}</div>
  )
}

export function Dashboard() {
  const navigate = useNavigate()
  const plans = useFolder('plans')
  const roadmaps = useFolder('roadmaps')
  const references = useFolder('references')
  const ideas = useFolder('ideas')
  const processes = useFolder('processes')
  const handoffs = useFolder('handoffs')
  const progress = useFolder('progress')

  const isLoading = plans.isLoading || roadmaps.isLoading || progress.isLoading
  const error = plans.error || roadmaps.error || progress.error

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { active: 0, done: 0, paused: 0, cancelled: 0 }
    for (const p of plans.data ?? []) {
      const s = p.frontmatter?.status ?? 'other'
      if (s in counts) counts[s] += 1
    }
    return counts
  }, [plans.data])

  const segments = useMemo(() => {
    const total = Object.values(statusBreakdown).reduce((a, b) => a + b, 0) || 1
    return [
      { label: 'Active', value: statusBreakdown.active, color: '#22c55e' },
      { label: 'Done', value: statusBreakdown.done, color: '#3b82f6' },
      { label: 'Paused', value: statusBreakdown.paused, color: '#f59e0b' },
      { label: 'Cancelled', value: statusBreakdown.cancelled, color: '#ef4444' },
    ].map((s) => ({ ...s, pct: Math.round((s.value / total) * 100) }))
  }, [statusBreakdown])

  const planTotal = (plans.data ?? []).length

  const topPlans = useMemo(
    () =>
      [...(plans.data ?? [])]
        .sort((a, b) => (b.frontmatter?.priority ?? 0) - (a.frontmatter?.priority ?? 0))
        .slice(0, 6),
    [plans.data],
  )

  const bars = useMemo(() => weeklyActivity(progress.data), [progress.data])
  const barMax = Math.max(...bars.map((b) => b.value), 1)

  const progressLog = useMemo(
    () =>
      [...(progress.data ?? [])]
        .sort(
          (a, b) =>
            (parseCreated(b.frontmatter?.created)?.getTime() ?? 0) -
            (parseCreated(a.frontmatter?.created)?.getTime() ?? 0),
        )
        .slice(0, 5),
    [progress.data],
  )

  const libraryCount =
    (references.data?.length ?? 0) + (ideas.data?.length ?? 0) + (processes.data?.length ?? 0)
  const activePlans = statusBreakdown.active
  const activeRoadmaps = (roadmaps.data ?? []).filter((r) => r.frontmatter?.status === 'active').length
  const openHandoffs = (handoffs.data ?? []).filter((h) => h.frontmatter?.status === 'active').length

  const totalItems =
    planTotal +
    (roadmaps.data?.length ?? 0) +
    libraryCount +
    (handoffs.data?.length ?? 0) +
    (progress.data?.length ?? 0)

  const domainCount = [
    plans.data,
    roadmaps.data,
    references.data,
    ideas.data,
    processes.data,
    handoffs.data,
    progress.data,
  ].filter((d) => (d?.length ?? 0) > 0).length

  const updated = latestDate([plans.data, progress.data, roadmaps.data])
  const updatedLabel = updated
    ? `${updated.getFullYear()}-W${String(isoWeek(updated)[1]).padStart(2, '0')} · ${MONTHS[updated.getMonth()]} ${updated.getDate()}`
    : '—'

  const newThisWeek = useMemo(() => {
    if (!updated) return 0
    const [ty, tw] = isoWeek(updated)
    let n = 0
    for (const list of [plans.data, progress.data, roadmaps.data]) {
      for (const it of list ?? []) {
        const d = parseCreated(it.frontmatter?.created)
        if (!d) continue
        const [y, w] = isoWeek(d)
        if (y === ty && w === tw) n += 1
      }
    }
    return n
  }, [plans.data, progress.data, roadmaps.data, updated])

  if (isLoading) return <div className="px-10 py-6"><DashboardSkeleton /></div>
  if (error) return <div className="px-10 py-6 text-sm text-red">Error: {(error as Error).message}</div>

  const kpis = [
    { label: 'PLANS', count: planTotal, delta: `+${activePlans} active`, color: '#22c55e' },
    { label: 'ROADMAPS', count: roadmaps.data?.length ?? 0, delta: `${activeRoadmaps} in flight`, color: '#3b82f6' },
    { label: 'HANDOFFS', count: handoffs.data?.length ?? 0, delta: `${openHandoffs} open`, color: '#a78bfa' },
    { label: 'LIBRARY', count: libraryCount, delta: 'refs+ideas+procs', color: '#f59e0b' },
  ]

  return (
    <div className="animate-fade-in">
      {/* header */}
      <div className="px-10 pt-[26px]">
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 border-b border-border pb-4 font-mono text-[11px] text-dim">
          <span>REPO <span className="text-secondary">samir1498/personal-context</span></span>
          <span className="text-[#2c2c30]">│</span>
          <span>BRANCH <span className="text-secondary">main</span></span>
          <span className="text-[#2c2c30]">│</span>
          <span>UPDATED <span className="text-secondary">{updatedLabel}</span></span>
        </div>
        <div className="flex items-end justify-between gap-6 py-6">
          <div>
            <h1 className="m-0 text-[52px] font-bold leading-[0.95] tracking-[-0.035em]">Dashboard</h1>
            <p className="mt-3.5 font-mono text-sm text-muted">
              <span className="text-foreground">{totalItems}</span> items · {domainCount} domains · {newThisWeek} new this week
            </p>
          </div>
          <div className="flex select-none gap-2.5 font-mono text-xs">
            <span className="cursor-default border border-line px-[15px] py-2.5 tracking-[0.03em] text-secondary">SEARCH /</span>
            <span className="cursor-default bg-foreground px-4 py-2.5 font-semibold tracking-[0.03em] text-page">+ NEW PLAN</span>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-4 border-y border-border">
        {kpis.map((k, i) => (
          <div key={k.label} className={`v2row px-6 pb-6 pt-[22px] ${i > 0 ? 'border-l border-border' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.12em] text-dim">
                {String(i + 1).padStart(2, '0')} — {k.label}
              </span>
              <span className="inline-block h-[7px] w-[7px]" style={{ background: k.color }} />
            </div>
            <div className="mt-[18px] text-[46px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              {k.count}
            </div>
            <div className="mt-2.5 font-mono text-[11px] text-dim">{k.delta}</div>
          </div>
        ))}
      </div>

      {/* two-column body */}
      <div className="grid grid-cols-[1fr_1px_1fr] px-10">
        <div>
          {/* plan status */}
          <section className="border-b border-border py-[26px] pr-8">
            <SectionLabel>01 / PLAN STATUS</SectionLabel>
            <div className="mt-[18px] flex items-end gap-2.5">
              <span className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{planTotal}</span>
              <span className="pb-1.5 font-mono text-[11px] text-dim">TOTAL PLANS</span>
            </div>
            <div className="mt-[18px] flex h-2 gap-0.5">
              {segments.map((s) => (
                <div
                  key={s.label}
                  className="h-full transition-[width] duration-700"
                  style={{ width: `${(s.value / (planTotal || 1)) * 100}%`, background: s.color }}
                />
              ))}
            </div>
            <div className="mt-[22px]">
              {segments.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-3 border-b border-faintline py-2.5 font-mono text-xs"
                >
                  <span className="inline-block h-2 w-2" style={{ background: s.color }} />
                  <span className="flex-1 tracking-[0.02em] text-secondary">{s.label}</span>
                  <span className="w-[46px] text-right text-dim">{s.pct}%</span>
                  <span className="w-7 text-right font-semibold text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* top plans */}
          <section className="py-[26px] pr-8">
            <div className="flex items-center justify-between">
              <SectionLabel>03 / TOP PLANS BY PRIORITY</SectionLabel>
              <button
                onClick={() => navigate({ to: '/plans' })}
                className="cursor-pointer font-mono text-[11px] text-secondary hover:text-foreground"
              >
                ALL →
              </button>
            </div>
            <div className="grid grid-cols-[52px_1fr_auto] gap-3.5 py-2 pt-4 font-mono text-[10px] tracking-[0.08em] text-faint">
              <span>PRIO</span>
              <span>PLAN</span>
              <span>STATUS</span>
            </div>
            {topPlans.map((p) => {
              const fm = p.frontmatter ?? {}
              return (
                <button
                  key={p.slug}
                  onClick={() => navigate({ to: '/plan/$slug', params: { slug: p.slug } })}
                  className="v2row grid w-full cursor-pointer grid-cols-[52px_1fr_auto] items-center gap-3.5 border-t border-faintline py-3 text-left"
                >
                  <span className="font-mono text-[13px] font-semibold" style={{ color: priorityColor(fm.priority) }}>
                    P{fm.priority ?? '—'}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium tracking-[-0.01em]">{fm.title ?? p.slug}</div>
                    {fm.tldr && <div className="mt-0.5 truncate font-mono text-[11px] text-dim">{fm.tldr}</div>}
                  </div>
                  <span className="font-mono text-[11px]" style={{ color: statusColor(fm.status) }}>
                    [{fm.status ?? '—'}]
                  </span>
                </button>
              )
            })}
          </section>
        </div>

        <div className="bg-border" />

        <div>
          {/* weekly activity */}
          <section className="border-b border-border py-[26px] pl-8">
            <div className="flex items-center justify-between">
              <SectionLabel>02 / WEEKLY ACTIVITY</SectionLabel>
              <span className="font-mono text-[10px] text-faint">ENTRIES / WK</span>
            </div>
            {bars.length > 0 ? (
              <>
                <div className="relative mt-[22px] h-[170px]">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    <div className="border-t border-dotted border-[#1c1c20]" />
                    <div className="border-t border-dotted border-[#1c1c20]" />
                    <div className="border-t border-dotted border-[#1c1c20]" />
                    <div className="border-t border-[#232328]" />
                  </div>
                  <div className="relative flex h-full items-end gap-[9px]">
                    {bars.map((b, i) => (
                      <div key={b.label + i} className="flex h-full flex-1 flex-col items-center justify-end gap-[7px]">
                        <span className="font-mono text-[10px] text-muted">{b.value}</span>
                        <div
                          className="w-full transition-[height] duration-700"
                          style={{ height: `${(b.value / barMax) * 100}%`, background: i === bars.length - 1 ? '#f3f2ee' : '#3a3a40' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex gap-[9px]">
                  {bars.map((b, i) => (
                    <span key={b.label + i} className="flex-1 text-center font-mono text-[9px] text-faint">{b.label}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-10 text-center font-mono text-[11px] text-faint">no progress entries</p>
            )}
          </section>

          {/* progress log */}
          <section className="py-[26px] pl-8">
            <SectionLabel>04 / PROGRESS LOG</SectionLabel>
            <div className="mt-4">
              {progressLog.map((p) => {
                const fm = p.frontmatter ?? {}
                const d = parseCreated(fm.created)
                const dateLabel = d ? `${d.getFullYear()}-W${String(isoWeek(d)[1]).padStart(2, '0')} · ${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}` : '—'
                return (
                  <div key={p.slug} className="grid grid-cols-[130px_1fr] items-baseline gap-4 border-t border-faintline py-3.5">
                    <span className="font-mono text-[11px] text-dim">{dateLabel}</span>
                    <div className="flex items-baseline gap-2.5">
                      <span className="inline-block h-[7px] w-[7px] flex-shrink-0 translate-y-px" style={{ background: statusColor(fm.status) }} />
                      <span className="text-[13.5px] tracking-[-0.01em] text-secondary">{fm.title ?? p.slug}</span>
                    </div>
                  </div>
                )
              })}
              {progressLog.length === 0 && (
                <p className="py-10 text-center font-mono text-[11px] text-faint">no progress entries</p>
              )}
            </div>
          </section>
        </div>
      </div>
      <div className="h-6" />
    </div>
  )
}
