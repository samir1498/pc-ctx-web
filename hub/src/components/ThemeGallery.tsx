import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { THEMES, THEME_EVENT, activeTheme, applyTheme, type ThemeKey } from '../lib/themes'

const BARS = [
  [38, 22, 9],
  [52, 30, 12],
  [44, 18, 16],
  [61, 34, 10],
  [70, 29, 14],
  [48, 24, 8],
  [77, 36, 18],
]

// Each card sets data-theme on itself, so all themes render live side by side.
function Preview({ theme }: { theme: Exclude<ThemeKey, 'system'> }) {
  return (
    <div data-theme={theme} className="flex h-56 overflow-hidden rounded-card border border-border bg-page font-sans text-fg">
      <div className="w-24 shrink-0 space-y-1.5 border-r border-border bg-rail p-2.5 text-xs">
        <div className="mb-3 size-5 rounded-md bg-accent" />
        <div className="rounded bg-accent-soft px-1.5 py-0.5 text-accent">Dashboard</div>
        {['Usage', 'Plans', 'Reports', 'Designs'].map((x) => (
          <div key={x} className="px-1.5 py-0.5 text-muted">{x}</div>
        ))}
      </div>
      <div className="min-w-0 flex-1 p-3">
        <div className="font-display text-base font-bold">Dashboard</div>
        <div className="text-xs text-muted">681 documents across 12 sections</div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="card p-2">
            <div className="eyebrow">Cost</div>
            <div className="num text-sm">$2,184</div>
          </div>
          <div className="card p-2">
            <div className="eyebrow">Tokens</div>
            <div className="num text-sm">2.61B</div>
          </div>
        </div>
        <div className="card mt-2 flex h-16 items-end gap-1 p-2">
          {BARS.map(([a, b, c], i) => (
            <div key={i} className="flex flex-1 flex-col-reverse gap-px">
              <div className="rounded-b-sm" style={{ height: a / 3, background: 'var(--series-1)' }} />
              <div style={{ height: b / 3, background: 'var(--series-2)' }} />
              <div className="rounded-t-sm" style={{ height: c / 3, background: 'var(--series-3)' }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Active</span>
          <span className="rounded-full bg-good/10 px-2 py-0.5 text-xs text-good">Done</span>
          <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">Paused</span>
        </div>
      </div>
    </div>
  )
}

export default function ThemeGallery() {
  const [current, setCurrent] = useState<ThemeKey>('system')
  useEffect(() => {
    setCurrent(activeTheme())
    const on = () => setCurrent(activeTheme())
    window.addEventListener(THEME_EVENT, on)
    return () => window.removeEventListener(THEME_EVENT, on)
  }, [])

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {THEMES.map((t) => {
        const on = current === t.key
        return (
          <div key={t.key} className={`card p-3 ${on ? 'ring-2 ring-accent' : ''}`}>
            {t.key === 'system' ? (
              <div className="grid h-56 grid-cols-2 overflow-hidden rounded-card border border-border">
                <div data-theme="light" className="grid place-items-center bg-page font-display text-sm text-fg">Light by day</div>
                <div data-theme="dark" className="grid place-items-center bg-page font-display text-sm text-fg">Dark by night</div>
              </div>
            ) : (
              <Preview theme={t.key} />
            )}
            <div className="mt-3 flex items-center justify-between gap-3 px-1">
              <div>
                <div className="font-medium">{t.label}</div>
                <div className="text-xs text-dim">{t.note}</div>
              </div>
              <button
                onClick={() => applyTheme(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${on ? 'bg-accent text-accent-fg' : 'border border-border hover:bg-hover'}`}
              >
                {on && <Check className="size-4" aria-hidden />}
                {on ? 'In use' : 'Use'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
