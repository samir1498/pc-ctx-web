import { useState } from 'react'
import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

// Layout for the original engineering pages (dashboard, plans, roadmaps, …),
// unchanged from the pre-hub RootLayout — kept working at their own routes.
export function EngLayout({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-page text-foreground">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
            className="flex h-8 w-8 flex-col items-center justify-center gap-1.5 border border-line"
          >
            <span className="h-px w-4 bg-foreground" />
            <span className="h-px w-4 bg-foreground" />
            <span className="h-px w-4 bg-foreground" />
          </button>
          <span className="flex items-center gap-2 text-base font-bold tracking-[-0.02em]">
            <span className="inline-block h-2 w-2 bg-foreground" />
            pc&#8209;ctx
          </span>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
