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

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** "2026-11-25" -> "2026-11" */
export const monthKey = (d: string) => d.slice(0, 7)
/** "2026-11" -> "November 2026" */
export const monthName = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1] ?? ''} ${k.slice(0, 4)}`
/** "2026-11" -> "Nov" */
export const monthShort = (k: string) => (MONTHS[Number(k.slice(5, 7)) - 1] ?? '').slice(0, 3)

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
