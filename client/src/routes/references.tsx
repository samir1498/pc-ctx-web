import { createFileRoute } from '@tanstack/react-router'
import { ReferencesPage } from '../pages/ReferencesPage'

export const Route = createFileRoute('/references')({
  component: ReferencesPage,
})
