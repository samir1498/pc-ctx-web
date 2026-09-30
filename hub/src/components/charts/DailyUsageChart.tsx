import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { UsageRow } from '../../mock/usage'
import { byDay, keysOf, labelOf, slotOf, type GroupBy, type Metric } from '../../lib/usage'
import { dayLabel, tokens, usd } from '../../lib/format'
import { BASE_TOKENS, useTokens } from '../../lib/useTokens'

const SERIES = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8', '--series-other'] as const
const ALL = [...BASE_TOKENS, ...SERIES] as const

interface Props {
  rows: UsageRow[]
  group: GroupBy
  metric: Metric
  height?: number
}

export default function DailyUsageChart({ rows, group, metric, height = 280 }: Props) {
  const t = useTokens(ALL)
  const data = byDay(rows, group, metric)
  const present = keysOf(group).filter((k) => data.some((d) => ((d[k] as number | undefined) ?? 0) > 0))
  const fmt = metric === 'cost' ? (n: number) => usd(n) : tokens
  const color = (k: string) => t[slotOf(group, k) as (typeof SERIES)[number]] || t['--accent']

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Legend">
        {present.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: `var(${slotOf(group, k)})` }} />
            {labelOf(group, k)}
          </li>
        ))}
      </ul>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={t['--border']} />
            <XAxis
              dataKey="date"
              tickFormatter={dayLabel}
              tick={{ fill: t['--dim'], fontSize: 11 }}
              axisLine={{ stroke: t['--line'] }}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fill: t['--dim'], fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip
              cursor={{ fill: t['--hover'] }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const items = payload.filter((p) => Number(p.value) > 0).reverse()
                const total = items.reduce((s, p) => s + Number(p.value), 0)
                return (
                  <div className="card min-w-48 p-3 text-xs shadow-xl">
                    <div className="mb-2 font-medium text-fg">{dayLabel(String(label))}</div>
                    {items.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5 text-muted">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-sm" style={{ background: String(p.color) }} />
                          {labelOf(group, String(p.dataKey))}
                        </span>
                        <span className="num text-fg">{fmt(Number(p.value))}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-fg">
                      <span>Total</span>
                      <span className="num">{fmt(total)}</span>
                    </div>
                  </div>
                )
              }}
            />
            {present.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="a"
                fill={color(k)}
                stroke={t['--panel']}
                strokeWidth={1}
                radius={i === present.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
