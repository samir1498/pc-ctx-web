interface DonutChartProps {
  data: { label: string; value: number; color: string }[]
  size?: number
  strokeWidth?: number
}

export function DonutChart({ data, size = 160, strokeWidth = 24 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let offset = 0
  const segments = data.map((d) => {
    const ratio = d.value / total
    const length = ratio * circumference
    const seg = { ...d, offset, length, ratio }
    offset += length
    return seg
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {segments.map((seg) => (
        <circle
          key={seg.label}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.length} ${circumference - seg.length}`}
          strokeDashoffset={-seg.offset}
          className="transition-all duration-700 ease-out"
          style={{ animation: `donut-fill 0.8s ease-out forwards` }}
        />
      ))}
    </svg>
  )
}
