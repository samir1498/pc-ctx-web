import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { RoadmapsPage } from '../pages/RoadmapsPage'

export const Route = createFileRoute('/roadmaps')({
  component: () => (
    <EngLayout>
      <RoadmapsPage />
    </EngLayout>
  ),
})
