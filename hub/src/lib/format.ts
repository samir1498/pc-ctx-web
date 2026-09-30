export function tokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(Math.round(n))
}

export function usd(n: number, cents = false): string {
  if (n === 0) return '$0'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents || n < 100 ? 2 : 0,
    minimumFractionDigits: 0,
  })
}

export function count(n: number): string {
  return n.toLocaleString('en-US')
}

export function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`
}

export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
