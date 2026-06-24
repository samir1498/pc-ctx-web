import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
<<<<<<< HEAD
    <div className="flex h-screen w-full overflow-hidden bg-page text-foreground">
=======
    <div className="flex h-screen overflow-hidden bg-page">
>>>>>>> origin/main
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
