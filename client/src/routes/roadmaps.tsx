import { createFileRoute } from '@tanstack/react-router'
import { RoadmapsPage } from '../pages/RoadmapsPage'

export const Route = createFileRoute('/roadmaps')({
  component: RoadmapsPage,
})
