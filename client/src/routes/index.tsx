import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useProjects } from '../hooks/useContext'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

// No route-level loader here: the project list is a runtime fetch (or a
// settings-store read), not something the router can resolve at build time.
function RouteComponent() {
  const { data: projects, isLoading, error } = useProjects()

  if (isLoading) return null
  if (error || !projects || projects.length === 0) {
    return <Navigate to="/settings" />
  }
  return <Navigate to="/p/$project" params={{ project: projects[0].id }} />
}
