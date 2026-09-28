import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useConfig, useProjects } from '../hooks/useContext'
import { useHubNav } from '../hooks/useHubNav'
import { currentItem } from '../lib/nav'
import type { NavGroup } from '../lib/nav'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function Freshness() {
  const { data: config, error } = useConfig()
  const now = new Date()
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  // Unknown mode (still loading, or the config fetch itself failed) never claims a source.
  const source = error ? 'source unknown' : config?.mode === 'deployed' ? 'GitHub, cached up to 5 min' : config?.mode === 'local' ? 'read from disk' : null
  return (
    <p className="m-0 font-mono text-2xs leading-relaxed text-faint">
      Data as of {time}
      {source ? <><br />{source}</> : null}
    </p>
  )
}

function ProjectSwitcher({ project }: { project?: string }) {
  const { data: projects } = useProjects()
  const list = projects ?? []
  if (list.length === 0) return null
  return (
    <nav aria-label="Project" className="switcher">
      {list.map((p) => (
        <Link key={p.id} to="/p/$project" params={{ project: p.id }} activeOptions={{ exact: false }} aria-current={p.id === project ? 'page' : undefined}>
          {p.name}
        </Link>
      ))}
    </nav>
  )
}

// A rail link whose "current" state the nav builder decides. The router's own
// <Link> always stamps aria-current on a path match, which would also light up
// "7 more" (it points at the board) while the board is open; a plain anchor
// that navigates through the router keeps one highlighted row per page.
function NavAnchor({ to, current, className, onNavigate, children }: { to: string; current: boolean; className: string; onNavigate: () => void; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <a
      href={to}
      className={className}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        onNavigate()
        void navigate({ to })
      }}
    >
      {children}
    </a>
  )
}

function NavGroups({ groups, onNavigate }: { groups: NavGroup[]; onNavigate: () => void }) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.key} className="nav-group" aria-label={g.label || 'Start'}>
          {g.label ? (
            g.to ? (
              <NavAnchor to={g.to} current={false} className="nav-label" onNavigate={onNavigate}>
                {g.label}
              </NavAnchor>
            ) : (
              <span className="nav-label">{g.label}</span>
            )
          ) : null}
          {g.items.map((it) => (
            <NavAnchor key={it.to + it.label} to={it.to} current={it.current} className={`nav-row${it.muted ? ' muted' : ''}`} onNavigate={onNavigate}>
              <span className="text">{it.label}</span>
              {it.meta ? <span className="meta">{it.meta}</span> : null}
            </NavAnchor>
          ))}
        </section>
      ))}
    </>
  )
}

interface HubShellProps {
  project?: string
  children: ReactNode
}

// The docs shell: a grouped rail on the left that stays put while the reading
// pane on the right changes. On a phone the rail becomes a drawer.
export function HubShell({ project, children }: HubShellProps) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { data: projects } = useProjects()
  const { groups } = useHubNav(project)
  const summary = projects?.find((p) => p.id === project)
  const here = currentItem(groups)
  const onSettings = pathname === '/settings'

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => setOpen(false)

  return (
    <div className="flex h-dvh w-full flex-col bg-page text-foreground md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
      <header className="flex items-center gap-3 border-b border-border bg-rail px-3 py-2 md:hidden">
        <button
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="hub-rail"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-[5px] rounded-md border border-line bg-panel"
        >
          <span className="h-px w-4 bg-foreground" />
          <span className="h-px w-4 bg-foreground" />
          <span className="h-px w-4 bg-foreground" />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">{onSettings ? 'Settings' : (summary?.name ?? 'Context hub')}</div>
          {here && here.label !== 'Overview' && <div className="truncate text-xs text-muted">{here.label}</div>}
        </div>
        <Link to="/settings" aria-label="Settings" className="shrink-0 font-mono text-xs text-muted no-underline">
          Settings
        </Link>
      </header>

      {open && <button type="button" aria-label="Close navigation" onClick={close} className="fixed inset-0 z-30 bg-black/40 md:hidden" />}

      <aside
        id="hub-rail"
        className={`rail fixed inset-y-0 left-0 z-40 flex w-[18rem] max-w-[85vw] flex-col transition-transform duration-200 md:static md:z-auto md:w-auto md:max-w-none md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 pb-3 pt-4">
          <div className="mb-3 flex items-baseline justify-between">
            <Link to="/" className="font-mono text-2xs uppercase tracking-[0.12em] text-faint no-underline hover:text-foreground">
              Context hub
            </Link>
            <button type="button" onClick={close} aria-label="Close navigation" className="font-mono text-xs text-faint md:hidden">
              close
            </button>
          </div>
          <ProjectSwitcher project={project} />
        </div>

        <nav aria-label="Pages" className="flex-1 overflow-y-auto pb-6">
          {project ? (
            <NavGroups groups={groups} onNavigate={close} />
          ) : (
            <section className="nav-group">
              <span className="nav-label">Site</span>
              <Link to="/settings" className="nav-row" aria-current={onSettings ? 'page' : undefined} onClick={close}>
                <span className="text">Settings</span>
              </Link>
            </section>
          )}
        </nav>

        <div className="flex items-end justify-between gap-3 border-t border-border px-4 py-3">
          <Freshness />
          {project && (
            <Link to="/settings" className="font-mono text-2xs text-faint no-underline hover:text-foreground">
              Settings
            </Link>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
