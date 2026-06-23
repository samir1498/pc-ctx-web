import { createRootRoute, Outlet, useLocation } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import type { Folder } from '../types'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { pathname } = useLocation()
  const activeFolder: Folder | null =
    pathname.startsWith('/plans') || pathname.startsWith('/plan') ? 'plans' :
    pathname.startsWith('/roadmaps') ? 'roadmaps' :
    pathname.startsWith('/references') ? 'references' :
    pathname.startsWith('/progress') ? 'progress' : null

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <Sidebar activeFolder={activeFolder} />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full overflow-y-auto px-6 lg:px-10 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
