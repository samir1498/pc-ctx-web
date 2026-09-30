import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { THEMES, applyTheme, storedTheme, type ThemeKey } from '../lib/themes'

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeKey>('system')
  useEffect(() => setTheme(storedTheme()), [])

  return (
    <label className="flex items-center gap-2 rounded-card border border-border bg-panel px-2.5 py-1.5 text-sm text-muted">
      <Palette className="size-4" aria-hidden />
      <span className="sr-only">Theme</span>
      <select
        className="bg-transparent text-fg outline-none"
        value={theme}
        onChange={(e) => {
          const key = e.target.value as ThemeKey
          setTheme(key)
          applyTheme(key)
        }}
      >
        {THEMES.map((t) => (
          <option key={t.key} value={t.key} className="bg-panel text-fg">
            {t.label}
          </option>
        ))}
      </select>
    </label>
  )
}
