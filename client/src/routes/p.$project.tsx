import { createFileRoute, Outlet } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'

// Layout only — the home page itself lives in p.$project.index.tsx so that
// child routes (plans, plan/$slug, reports/$slug, standups/$slug) render
// through this Outlet instead of being shadowed by the home content.
export const Route = createFileRoute('/p/$project')({
  component: () => (
    <HubLayout>
      <Outlet />
    </HubLayout>
  ),
})
