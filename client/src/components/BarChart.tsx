import { motion } from 'framer-motion'

interface BarChartProps {
  data: { label: string; value: number }[]
  max?: number
  color?: string
  height?: number
}

export function BarChart({ data, max, color = 'var(--color-accent)', height = 120 }: BarChartProps) {
  const maxVal = max ?? Math.max(...data.map((d) => d.value), 1)
  const barGap = 4
  const barWidth = Math.max(8, Math.min(32, (height - barGap * (data.length - 1)) / data.length))

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const pct = (d.value / maxVal) * 100
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t"
              style={{ backgroundColor: color, maxHeight: '100%' }}
              initial={{ height: 0 }}
              animate={{ height: `${pct}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
            />
            <span className="text-[8px] text-secondary/60">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}
