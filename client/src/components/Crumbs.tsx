import { Link } from '@tanstack/react-router'

export interface Crumb {
  label: string
  to?: string
}

// "Dinar / Plans / The till": every part but the last is a link.
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumb">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-[0.4rem]">
          {i > 0 && <span aria-hidden="true">/</span>}
          {c.to && i < items.length - 1 ? <Link to={c.to}>{c.label}</Link> : <span className={i === items.length - 1 ? 'text-muted' : ''}>{c.label}</span>}
        </span>
      ))}
    </nav>
  )
}

export function PageState({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return <div className={`reader text-sm ${tone === 'error' ? 'text-red' : 'text-muted'}`}>{children}</div>
}
