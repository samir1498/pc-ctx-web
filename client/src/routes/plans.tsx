import { createFileRoute } from '@tanstack/react-router'
import { PlansPage } from '../pages/PlansPage'

export const Route = createFileRoute('/plans')({
  component: PlansPage,
})
