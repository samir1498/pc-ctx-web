import { createFileRoute } from '@tanstack/react-router'
import { ProcessesPage } from '../pages/ProcessesPage'

export const Route = createFileRoute('/processes')({
  component: ProcessesPage,
})
