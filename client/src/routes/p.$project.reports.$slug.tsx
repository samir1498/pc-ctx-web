import { createFileRoute } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'
import { ReportPage } from '../pages/hub/ReportPage'

export const Route = createFileRoute('/p/$project/reports/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, slug } = Route.useParams()
  return (
    <HubLayout>
      <ReportPage project={project} slug={slug} />
    </HubLayout>
  )
}
