import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { THEMES, THEME_EVENT, activeTheme, applyTheme, type ThemeKey } from '../lib/themes'

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeKey>('system')
  useEffect(() => {
    setTheme(activeTheme())
    const on = () => setTheme(activeTheme())
    window.addEventListener(THEME_EVENT, on)
    return () => window.removeEventListener(THEME_EVENT, on)
  }, [])

  return (
    <label className="relative inline-flex h-[34px] items-center px-1 text-sm text-muted">
      <span className="sr-only">Theme</span>
      <select
        className="cursor-pointer appearance-none bg-transparent pr-5 text-muted outline-none focus-visible:underline"
        value={theme}
        onChange={(e) => {
          const next = THEMES.find((t) => t.key === e.target.value)
          if (!next) return
          setTheme(next.key)
          applyTheme(next.key)
        }}
      >
        {THEMES.map((t) => (
          <option key={t.key} value={t.key} className="bg-panel text-fg">
            {t.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 size-3.5 text-dim" strokeWidth={2.5} aria-hidden />
    </label>
  )
}
