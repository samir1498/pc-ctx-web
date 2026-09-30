import { useMemo, useState } from 'react'
import type { UsageRow } from '../lib/usage-types'
import { TOOL_LABEL } from '../lib/usage-types'
import { byModel, keysOf, lastDays, previousDays, priceLabel, slotOf, sum, totalTokens, type GroupBy, type Metric } from '../lib/usage'
import { count, dayLabel, pct, tokens, usd } from '../lib/format'
import DailyUsageChart from './charts/DailyUsageChart'
import MiniBars from './charts/MiniBars'

const RANGES = [7, 14, 30] as const
const GROUPS: { key: GroupBy; label: string }[] = [
  { key: 'tool', label: 'Tool' },
  { key: 'provider', label: 'Provider' },
  { key: 'model', label: 'Model' },
]
const METRICS: { key: Metric; label: string }[] = [
  { key: 'cost', label: 'Cost' },
  { key: 'tokens', label: 'Tokens' },
]

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

export default function UsageExplorer({ rows }: { rows: UsageRow[] }) {
  const [range, setRange] = useState<number>(14)
  const [group, setGroup] = useState<GroupBy>('tool')
  const [metric, setMetric] = useState<Metric>('cost')
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const keys = useMemo(() => keysOf(group, rows), [rows, group])
  const modelKeys = useMemo(() => keysOf('model', rows), [rows])
  const cur = useMemo(() => lastDays(rows, range), [rows, range])
  const prev = useMemo(() => previousDays(rows, range), [rows, range])
  const t = sum(cur)
  const p = sum(prev)
  const all = totalTokens(t)
  const delta = (a: number, b: number) => (b > 0 ? a / b - 1 : undefined)
  const cacheHit = t.cacheRead / Math.max(1, t.cacheRead + t.input + t.cacheWrite)
  const models = byModel(cur)
  const days = [...new Set(cur.map((r) => r.date))].sort()
  const perDay = days.map((d) => ({ date: d, ...sum(cur.filter((r) => r.date === d)) }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented label="Range" value={range} options={RANGES.map((r) => ({ key: r, label: `${r} days` }))} onChange={setRange} />
        <Segmented label="Group by" value={group} options={GROUPS} onChange={setGroup} />
        <Segmented label="Show" value={metric} options={METRICS} onChange={setMetric} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Cost, API equivalent" value={usd(t.cost)} delta={delta(t.cost, p.cost)} />
        <Kpi label="Tokens" value={tokens(all)} delta={delta(all, totalTokens(p))} />
        <Kpi label="Model calls" value={count(t.calls)} delta={delta(t.calls, p.calls)} />
        <Kpi label="Cache hit rate" value={`${Math.round(cacheHit * 100)}%`} note="share of prompt tokens read from cache" />
      </div>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">
            {metric === 'cost' ? 'Cost' : 'Tokens'} per day, by {group}
          </h2>
          <div className="flex gap-1 text-xs">
            {(['chart', 'table'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-md px-2 py-1 ${view === v ? 'bg-hover text-fg' : 'text-dim hover:text-fg'}`}>
                {v === 'chart' ? 'Chart' : 'Table'}
              </button>
            ))}
          </div>
        </div>
        {view === 'chart' ? (
          <DailyUsageChart rows={cur} group={group} metric={metric} height={300} keys={keys} />
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel text-left text-xs text-dim">
                <tr>
                  <th className="py-2 font-medium">Day</th>
                  {TYPES.map((x) => <th key={x.key} className="py-2 text-right font-medium">{x.label}</th>)}
                  <th className="py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="num">
                {[...perDay].reverse().map((d) => (
                  <tr key={d.date} className="border-t border-border">
                    <td className="py-1.5 font-sans text-muted">{dayLabel(d.date)}</td>
                    {TYPES.map((x) => <td key={x.key} className="py-1.5 text-right">{tokens(d[x.key])}</td>)}
                    <td className="py-1.5 text-right">{usd(d.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 font-display text-lg font-semibold">By model</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[44rem] text-sm">
            <thead className="text-left text-xs text-dim">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Model</th>
                <th className="py-2 font-medium">Tool</th>
                <th className="py-2 font-medium">Provider</th>
                <th className="py-2 text-right font-medium">Calls</th>
                <th className="py-2 text-right font-medium">Input</th>
                <th className="py-2 text-right font-medium">Output</th>
                <th className="py-2 text-right font-medium">Cache read</th>
                <th className="py-2 text-right font-medium">Cache write</th>
                <th className="px-5 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const label = priceLabel(m)
                return (
                  <tr key={m.key} className="border-b border-border last:border-0 hover:bg-hover">
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="size-2.5 rounded-sm" style={{ background: `var(${slotOf(modelKeys, m.model)})` }} />
                        {m.model}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted">{TOOL_LABEL[m.tool]}</td>
                    <td className="py-2.5 text-muted">{m.provider}</td>
                    <td className="num py-2.5 text-right">
                      {count(m.calls)}
                      {m.errors > 0 && <span className="block text-xs text-dim">{count(m.errors)} failed</span>}
                    </td>
                    {m.calls === 0 ? (
                      <td colSpan={4} className="py-2.5 text-right text-xs text-dim">every call failed</td>
                    ) : (
                      <>
                        <td className="num py-2.5 text-right">{tokens(m.input)}</td>
                        <td className="num py-2.5 text-right">{tokens(m.output)}</td>
                        <td className="num py-2.5 text-right">{tokens(m.cacheRead)}</td>
                        <td className="num py-2.5 text-right">{tokens(m.cacheWrite)}</td>
                      </>
                    )}
                    <td className="num px-5 py-2.5 text-right">{label ? <span className="text-dim">{label}</span> : <span title={m.pricing === 'reported' ? 'As the tool reports it' : 'At list price'}>{usd(m.cost)}</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
