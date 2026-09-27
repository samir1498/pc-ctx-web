import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { PlanDetailPage } from '../pages/PlanDetailPage'

export const Route = createFileRoute('/plan/$slug')({
  component: PlanDetailRoute,
})

function PlanDetailRoute() {
  const { slug } = Route.useParams()
  return (
    <EngLayout>
      <PlanDetailPage slug={slug} />
    </EngLayout>
  )
}
