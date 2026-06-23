import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full overflow-y-auto px-6 lg:px-10 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
