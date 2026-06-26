import { createFileRoute } from '@tanstack/react-router'
import { HandoffsPage } from '../pages/HandoffsPage'

export const Route = createFileRoute('/handoffs')({
  component: HandoffsPage,
})
