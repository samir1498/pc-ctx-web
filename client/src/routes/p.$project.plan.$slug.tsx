import { createFileRoute } from '@tanstack/react-router'
import { HubPlanPage } from '../pages/hub/HubPlanPage'

export const Route = createFileRoute('/p/$project/plan/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, slug } = Route.useParams()
  return <HubPlanPage project={project} slug={slug} />
}
