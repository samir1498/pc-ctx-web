import { createFileRoute } from '@tanstack/react-router'
import { BoardPage } from '../pages/hub/BoardPage'

export const Route = createFileRoute('/p/$project/plans')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project } = Route.useParams()
  return <BoardPage project={project} />
}
