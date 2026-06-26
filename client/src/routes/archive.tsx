import { createFileRoute } from '@tanstack/react-router'
import { ArchivePage } from '../pages/ArchivePage'

export const Route = createFileRoute('/archive')({
  component: ArchivePage,
})
