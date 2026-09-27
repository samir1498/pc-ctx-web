import { createFileRoute } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'
import { HubHomePage } from '../pages/hub/HubHomePage'

export const Route = createFileRoute('/p/$project')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project } = Route.useParams()
  return (
    <HubLayout>
      <HubHomePage project={project} />
    </HubLayout>
  )
}
