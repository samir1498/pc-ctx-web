import { createFileRoute } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'
import { HubPlanPage } from '../pages/hub/HubPlanPage'

export const Route = createFileRoute('/p/$project/plan/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, slug } = Route.useParams()
  return (
    <HubLayout>
      <HubPlanPage project={project} slug={slug} />
    </HubLayout>
  )
}
