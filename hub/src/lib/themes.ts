export const THEMES = [
  { key: 'system', label: 'System', note: 'Light or dark, following the device' },
  { key: 'light', label: 'Light', note: 'Neutral daylight, blue accent' },
  { key: 'dark', label: 'Dark', note: 'Neutral dark, soft blue accent' },
  { key: 'midnight', label: 'Midnight', note: 'Near black with violet, the June dashboard direction' },
  { key: 'paper', label: 'Paper', note: 'Warm cream, serif headings, ink blue' },
  { key: 'fjord', label: 'Fjord', note: 'Cool slate, frost accent, easy on long evenings' },
  { key: 'terminal', label: 'Terminal', note: 'Black, phosphor green, monospace throughout' },
] as const

export type ThemeKey = (typeof THEMES)[number]['key']

export const THEME_STORAGE_KEY = 'hub-theme'
export const THEME_EVENT = 'hub-themechange'

let active: ThemeKey | null = null

export function applyTheme(key: ThemeKey): void {
  active = key
  const root = document.documentElement
  if (key === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', key)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, key)
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  window.dispatchEvent(new Event(THEME_EVENT))
}

/** The theme in use on this page; storage only persists it, and may be blocked. */
export function activeTheme(): ThemeKey {
  return active ?? storedTheme()
}

export function storedTheme(): ThemeKey {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v && THEMES.some((t) => t.key === v)) return v as ThemeKey
  } catch {
    // fall through
  }
  return 'system'
}
