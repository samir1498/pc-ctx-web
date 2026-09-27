import { createFileRoute } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'
import { StandupPage } from '../pages/hub/StandupPage'

export const Route = createFileRoute('/p/$project/standups/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, slug } = Route.useParams()
  return (
    <HubLayout>
      <StandupPage project={project} slug={slug} />
    </HubLayout>
  )
}
