import { createFileRoute } from '@tanstack/react-router'
import { IdeasPage } from '../pages/IdeasPage'

export const Route = createFileRoute('/ideas')({
  component: IdeasPage,
})
