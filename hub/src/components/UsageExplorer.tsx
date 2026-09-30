import { useMemo, useState } from 'react'
import type { PlanSample, UsageRow, UsageSession } from '../lib/usage-types'
import { byModel, keysOf, labelOf, lastDays, previousDays, slotOf, sum, totalTokens, windowDates, type GroupBy, type Metric } from '../lib/usage'
import { count, pct, tokens, usd } from '../lib/format'
import DailyUsageChart from './charts/DailyUsageChart'
import MiniBars from './charts/MiniBars'
import ModelTable from './ModelTable'
import SessionTable from './SessionTable'
import PlanChart from './charts/PlanChart'

const RANGES = [7, 14, 30] as const
const GROUPS: { key: GroupBy; label: string }[] = [
  { key: 'host', label: 'Host' },
  { key: 'tool', label: 'Tool' },
  { key: 'provider', label: 'Provider' },
  { key: 'model', label: 'Model' },
]
// Tokens lead: the subscriptions make cost a what-if, and it hides every tool but Claude Code.
const METRICS: { key: Metric; label: string }[] = [
  { key: 'tokens', label: 'Tokens' },
  { key: 'cost', label: 'API value' },
]
const SPLIT_MAX = 8

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-border bg-panel p-0.5">
        {options.map((o) => (
          <button
            key={String(o.key)}
            role="radio"
            aria-checked={o.key === value}
            onClick={() => onChange(o.key)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${o.key === value ? 'bg-accent text-accent-fg' : 'text-muted hover:text-fg'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, delta, note }: { label: string; value: string; delta?: number; note?: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-2 text-2xl font-medium text-fg">{value}</div>
      <div className="mt-1 text-xs text-dim">
        {delta !== undefined && <span className={delta >= 0 ? 'text-fg' : 'text-muted'}>{pct(delta)} vs previous</span>}
        {note}
      </div>
    </div>
  )
}

const TYPES = [
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'cacheRead', label: 'Cache read' },
  { key: 'cacheWrite', label: 'Cache write' },
] as const

export default function UsageExplorer({ rows, sessions, plan }: { rows: UsageRow[]; sessions: UsageSession[]; plan: PlanSample[] }) {
  const [range, setRange] = useState<number>(14)
  const [group, setGroup] = useState<GroupBy>('tool')
  const [metric, setMetric] = useState<Metric>('tokens')

  const keys = useMemo(() => keysOf(group, rows), [rows, group])
  const modelKeys = useMemo(() => keysOf('model', rows), [rows])
  const cur = useMemo(() => lastDays(rows, range), [rows, range])
  const prev = useMemo(() => previousDays(rows, range), [rows, range])
  const inWindow = useMemo(() => new Set(windowDates(rows, range)), [rows, range])
  const curSessions = useMemo(() => sessions.filter((s) => inWindow.has(s.date)), [sessions, inWindow])
  const curPlan = useMemo(() => plan.filter((p) => inWindow.has(p.at.slice(0, 10))), [plan, inWindow])
  const t = sum(cur)
  const p = sum(prev)
  const all = totalTokens(t)
  const delta = (a: number, b: number) => (b > 0 ? a / b - 1 : undefined)
  const cacheHit = t.cacheRead / Math.max(1, t.cacheRead + t.input + t.cacheWrite)
  const models = useMemo(() => byModel(cur), [cur])
  const days = useMemo(() => windowDates(rows, range), [rows, range])
  const perDay = days.map((d) => ({ date: d, ...sum(cur.filter((r) => r.date === d)) }))
  const measure = (x: ReturnType<typeof sum>) => (metric === 'cost' ? x.cost : totalTokens(x))
  const groups = keys
    .map((key) => {
      const mine = cur.filter((r) => r[group] === key)
      return { key, total: measure(sum(mine)), days: days.map((d) => ({ label: d, value: measure(sum(mine.filter((r) => r.date === d))) })) }
    })
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
  const split = groups.slice(0, SPLIT_MAX)
  const hidden = groups.length - split.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Range" value={range} options={RANGES.map((r) => ({ key: r, label: `${r} days` }))} onChange={setRange} />
        <Segmented label="Group by" value={group} options={GROUPS} onChange={setGroup} />
        <Segmented label="Show" value={metric} options={METRICS} onChange={setMetric} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Tokens" value={tokens(all)} delta={delta(all, totalTokens(p))} />
        <Kpi label="Model calls" value={count(t.calls)} delta={delta(t.calls, p.calls)} />
        <Kpi label="Cache hit rate" value={`${Math.round(cacheHit * 100)}%`} note="share of prompt tokens read from cache" />
        <Kpi label="API value" value={usd(t.cost)} note="what this would cost at API list prices" />
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">
          {metric === 'cost' ? 'API value' : 'Tokens'} per day, by {group}
        </h2>
        <DailyUsageChart rows={cur} group={group} metric={metric} height={300} keys={keys} dates={days} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Each {group} on its own scale</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {split.map((g) => (
            <div key={g.key} className="card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(${slotOf(keys, g.key)})` }} />
                  <span className="truncate">{labelOf(group, g.key)}</span>
                </span>
                <span className="num shrink-0 text-sm text-fg">{metric === 'cost' ? usd(g.total) : tokens(g.total)}</span>
              </div>
              <div className="mt-3">
                <MiniBars data={g.days} format={metric === 'cost' ? 'usd' : 'tokens'} labelFormat="day" height={80} color={slotOf(keys, g.key)} />
              </div>
            </div>
          ))}
        </div>
        {hidden > 0 && <p className="mt-2 text-xs text-dim">{hidden} smaller {group === 'model' ? 'models' : 'entries'} are in the table below.</p>}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold">Token types per day</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TYPES.map((x) => (
            <div key={x.key} className="card p-4">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">{x.label}</span>
                <span className="num text-sm text-fg">{tokens(t[x.key])}</span>
              </div>
              <div className="mt-3">
                <MiniBars data={perDay.map((d) => ({ label: d.date, value: d[x.key] }))} format="tokens" labelFormat="day" height={80} color="--series-1" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-dim">Each chart has its own scale. Cache reads run about a hundred times larger than the rest.</p>
      </section>

      <ModelTable models={models} colourKeys={modelKeys} />

      <SessionTable sessions={curSessions} />

      {curPlan.length > 0 && (
        <section className="card p-5">
          <h2 className="font-display text-lg font-semibold">Plan limits used</h2>
          <p className="mb-4 text-xs text-dim">The Claude desktop app's own samples of the subscription's 5-hour and 7-day limits. They cover the whole account: chat, Cowork and Code on every device.</p>
          <PlanChart samples={curPlan} />
        </section>
      )}
    </div>
  )
}
