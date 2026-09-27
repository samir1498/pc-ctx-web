import { createFileRoute } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'
import { BoardPage } from '../pages/hub/BoardPage'

export const Route = createFileRoute('/p/$project/plans')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project } = Route.useParams()
  return (
    <HubLayout>
      <BoardPage project={project} />
    </HubLayout>
  )
}
