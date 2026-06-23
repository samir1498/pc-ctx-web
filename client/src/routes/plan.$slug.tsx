import { createFileRoute } from '@tanstack/react-router'
import { PlanDetailPage } from '../pages/PlanDetailPage'

export const Route = createFileRoute('/plan/$slug')({
  component: PlanDetailRoute,
})

function PlanDetailRoute() {
  const { slug } = Route.useParams()
  return <PlanDetailPage slug={slug} />
}
