import { Link } from '@tanstack/react-router'
import { useCounts } from '../hooks/useContext'
import type { Folder } from '../types'

interface NavLeaf {
  label: string
  to: string
  folder?: Folder
  glyph?: string
}

const GROUPS: { title: string; items: NavLeaf[] }[] = [
  {
    title: 'PLANNING',
    items: [
      { label: 'Dashboard', to: '/' },
      { label: 'Plans', to: '/plans', folder: 'plans' },
      { label: 'Roadmaps', to: '/roadmaps', folder: 'roadmaps' },
      { label: 'Graph', to: '/graph', glyph: '◳' },
    ],
  },
  {
    title: 'SESSIONS',
    items: [
      { label: 'Handoffs', to: '/handoffs', folder: 'handoffs' },
      { label: 'Progress', to: '/progress', folder: 'progress' },
    ],
  },
  {
    title: 'LIBRARY',
    items: [
      { label: 'References', to: '/references', folder: 'references' },
      { label: 'Ideas', to: '/ideas', folder: 'ideas' },
      { label: 'Processes', to: '/processes', folder: 'processes' },
      { label: 'Archive', to: '/archive', folder: 'archive' },
    ],
  },
]

function NavRow({
  item,
  idx,
  count,
  onNavigate,
}: { item: NavLeaf; idx: number; count?: number; onNavigate: () => void }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: item.to === '/' }}
      onClick={onNavigate}
      className="group flex items-center gap-2 px-1.5 py-2 text-sm no-underline transition-colors"
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          <span
            className={`w-1.5 text-sm leading-none ${isActive ? 'text-foreground' : 'text-transparent'}`}
          >
            ▍
          </span>
          <span className="w-3.5 font-mono text-3xs text-faint">
            {String(idx).padStart(2, '0')}
          </span>
          <span
            className={`flex-1 tracking-[0.01em] ${isActive ? 'font-semibold text-foreground' : 'font-normal text-muted'}`}
          >
            {item.label}
          </span>
          {item.glyph ? (
            <span className="font-mono text-2xs text-dim">{item.glyph}</span>
          ) : count !== undefined ? (
            <span
              className={`font-mono text-2xs ${isActive ? 'text-muted' : 'text-dim'}`}
            >
              {count}
            </span>
          ) : null}
        </>
      )}
    </Link>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  // One request for all folder counts — no file bodies fetched.
  const { data: counts } = useCounts()
  let idx = 0
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col border-r border-border bg-page transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="border-b border-border px-5 pb-5 pt-6">
        <div className="flex items-center gap-2 text-lg font-bold tracking-[-0.02em]">
          <span className="inline-block h-2.5 w-2.5 bg-foreground" />
          pc&#8209;ctx
        </div>
        <div className="mt-2 font-mono text-3xs tracking-[0.04em] text-faint">
          CONTEXT&nbsp;BROWSER
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="px-3 pb-1.5 pt-3.5 font-mono text-3xs tracking-[0.16em] text-fainter">
              {g.title}
            </div>
            {g.items.map((item) => (
              <NavRow
                key={item.to}
                item={item}
                idx={idx++}
                count={item.folder ? counts?.[item.folder] : undefined}
                onNavigate={onClose}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-5 py-3.5 font-mono text-3xs leading-[1.9] text-dim">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 animate-blink bg-green" />
          SCHEMA&nbsp;VALID
        </div>
        <div className="mt-1 text-faint">
          {__APP_VERSION__} / {__GIT_HASH__}
        </div>
      </div>
    </aside>
  )
}
