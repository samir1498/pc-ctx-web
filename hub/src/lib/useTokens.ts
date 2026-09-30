import { useEffect, useState } from 'react'
import { THEME_EVENT } from './themes'

// Recharts writes colours into SVG attributes, where var() is unreliable, so read
// the resolved token values and re-read them when the theme or the OS scheme changes.
export function useTokens<K extends string>(names: readonly K[], scope?: () => Element | null): Record<K, string> {
  const read = (): Record<K, string> => {
    const el = scope?.() ?? (typeof document === 'undefined' ? null : document.documentElement)
    const out = {} as Record<K, string>
    for (const n of names) out[n] = el ? getComputedStyle(el).getPropertyValue(n).trim() : ''
    return out
  }
  const [tokens, setTokens] = useState<Record<K, string>>(() => read())

  useEffect(() => {
    const update = () => setTokens(read())
    update()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    window.addEventListener(THEME_EVENT, update)
    mq.addEventListener('change', update)
    return () => {
      window.removeEventListener(THEME_EVENT, update)
      mq.removeEventListener('change', update)
    }
    // names is a constant list per call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return tokens
}

export const BASE_TOKENS = ['--fg', '--muted', '--dim', '--border', '--line', '--panel', '--hover', '--accent'] as const
