import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PlanSample } from '../../lib/usage-types'
import { dayLabel } from '../../lib/format'
import { BASE_TOKENS, useTokens } from '../../lib/useTokens'

const ALL = [...BASE_TOKENS, '--series-1', '--series-2'] as const
const LINES = [
  { key: 'sevenDay', label: '7-day limit', slot: '--series-1' },
  { key: 'fiveHour', label: '5-hour limit', slot: '--series-2' },
] as const

const when = (at: string) => `${dayLabel(at.slice(0, 10))} ${at.slice(11)}`

export default function PlanChart({ samples, height = 220 }: { samples: PlanSample[]; height?: number }) {
  const t = useTokens(ALL)
  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 text-xs text-muted" aria-label="Legend">
        {LINES.map((l) => (
          <li key={l.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded" style={{ background: `var(${l.slot})` }} />
            {l.label}
          </li>
        ))}
      </ul>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={samples} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={t['--border']} />
            <XAxis dataKey="at" tickFormatter={(v: string) => dayLabel(v.slice(0, 10))} tick={{ fill: t['--dim'], fontSize: 11 }} axisLine={{ stroke: t['--line'] }} tickLine={false} minTickGap={40} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: t['--dim'], fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="card min-w-40 p-3 text-xs shadow-xl">
                    <div className="mb-2 font-medium text-fg">{when(String(label))}</div>
                    {LINES.map((l) => {
                      const v = payload.find((p) => p.dataKey === l.key)?.value
                      return (
                        <div key={l.key} className="flex justify-between gap-4 py-0.5 text-muted">
                          <span>{l.label}</span>
                          <span className="num text-fg">{v == null ? '–' : `${v}%`}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              }}
            />
            {LINES.map((l) => (
              <Line key={l.key} dataKey={l.key} type="stepAfter" stroke={t[l.slot]} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
