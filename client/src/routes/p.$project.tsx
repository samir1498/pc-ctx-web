import { createFileRoute, Outlet } from '@tanstack/react-router'
import { HubShell } from '../components/HubShell'

// Layout only — the home page itself lives in p.$project.index.tsx so that
// child routes (plans, plan/$slug, $folder, $folder/$slug) render through
// this Outlet inside the same shell, sidebar kept.
export const Route = createFileRoute('/p/$project')({
  component: Layout,
})

function Layout() {
  const { project } = Route.useParams()
  return (
    <HubShell project={project}>
      <Outlet />
    </HubShell>
  )
}
