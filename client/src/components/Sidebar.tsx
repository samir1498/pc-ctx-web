import { DashboardIcon, PlansIcon, RoadmapsIcon, ResearchIcon, ProgressIcon } from './Icons'
import { Link } from '@tanstack/react-router'

const nav = [
  { label: 'Dashboard', to: '/', icon: DashboardIcon },
  { label: 'Plans', to: '/plans', icon: PlansIcon },
  { label: 'Roadmaps', to: '/roadmaps', icon: RoadmapsIcon },
  { label: 'References', to: '/references', icon: ResearchIcon },
  { label: 'Progress', to: '/progress', icon: ProgressIcon },
]

export function Sidebar() {
  return (
    <aside className="w-56 border-r border-border bg-page flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-border">
        <h1 className="text-sm font-semibold text-foreground">pc-ctx</h1>
        <p className="text-xs text-secondary leading-tight">Context Browser</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {nav.map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeProps={{ className: 'bg-elevated text-foreground font-medium' }}
            inactiveProps={{ className: 'text-secondary hover:text-foreground hover:bg-elevated/50' }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors"
          >
            <Icon />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-border space-y-1.5">
        <a
          href="https://github.com/samir1498/personal-context"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-secondary hover:text-foreground transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          samir1498/personal-context
        </a>
        <p className="text-[10px] text-secondary/60 select-none">{__APP_VERSION__} ({__GIT_HASH__})</p>
      </div>
    </aside>
  )
}
