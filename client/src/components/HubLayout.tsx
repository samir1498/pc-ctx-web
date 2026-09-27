import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useConfig, useProjects } from '../hooks/useContext'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function Freshness() {
  const { data: config } = useConfig()
  const now = new Date()
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`
  const source = config?.mode === 'deployed' ? 'GitHub, cached up to 5 min' : 'read from disk'
  return (
    <span className="whitespace-nowrap font-mono text-2xs text-faint">
      data as of {time} · {source}
    </span>
  )
}

// Top tab bar for layout B: one tab per project, Settings on the right, no
// left sidebar — Anouar opens one project and reads plain words.
export function HubLayout({ children }: { children: ReactNode }) {
  const { data: projects } = useProjects()

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-page text-foreground">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-border pad-x py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {(projects ?? []).map((p) => (
            <Link key={p.id} to="/p/$project" params={{ project: p.id }} activeOptions={{ exact: false }} className="no-underline">
              {({ isActive }: { isActive: boolean }) => (
                <span className={`block border px-3 py-1.5 text-sm ${isActive ? 'border-line bg-elevated font-semibold' : 'border-transparent'}`}>
                  {p.name}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Freshness />
          <Link to="/settings" activeOptions={{ exact: true }} className="no-underline">
            {({ isActive }: { isActive: boolean }) => (
              <span className={`block border px-3 py-1.5 text-sm ${isActive ? 'border-line bg-elevated font-semibold' : 'border-transparent'}`}>
                Settings
              </span>
            )}
          </Link>
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
