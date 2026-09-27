import { createFileRoute } from '@tanstack/react-router'
import { StandupPage } from '../pages/hub/StandupPage'

export const Route = createFileRoute('/p/$project/standups/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, slug } = Route.useParams()
  return <StandupPage project={project} slug={slug} />
}
