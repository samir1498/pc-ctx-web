import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { BASE_TOKENS, useTokens } from '../../lib/useTokens'
import { dayLabel, tokens, usd } from '../../lib/format'

// Named formats, because island props must serialise (no functions from .astro).
const FORMATS = { tokens, usd, added: (n: number) => `${n} added` }
const LABELS = { day: dayLabel, plain: (s: string) => s }

interface Props {
  data: { label: string; value: number }[]
  format: keyof typeof FORMATS
  labelFormat?: keyof typeof LABELS
  height?: number
  color?: string // a token name, e.g. --series-1
  showAxis?: boolean
}

// One series, one axis. Used for weekly activity and the token-type small multiples.
export default function MiniBars({ data, format: fmt, labelFormat: lf = 'plain', height = 96, color = '--accent', showAxis = false }: Props) {
  const format = FORMATS[fmt]
  const labelFormat = LABELS[lf]
  const t = useTokens([...BASE_TOKENS, color] as const)
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="16%">
          {showAxis && (
            <XAxis dataKey="label" tickFormatter={labelFormat} tick={{ fill: t['--dim'], fontSize: 10 }} axisLine={{ stroke: t['--line'] }} tickLine={false} minTickGap={12} />
          )}
          <Tooltip
            cursor={{ fill: t['--hover'] }}
            content={({ active, payload }) => {
              const p = payload?.[0]
              if (!active || !p) return null
              const row = p.payload as { label: string; value: number }
              return (
                <div className="card px-2.5 py-1.5 text-xs shadow-lg">
                  <span className="text-muted">{labelFormat(row.label)}</span> <span className="num ml-2 text-fg">{format(row.value)}</span>
                </div>
              )
            }}
          />
          <Bar dataKey="value" fill={t[color] || t['--accent']} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
