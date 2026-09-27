import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { ArchivePage } from '../pages/ArchivePage'

export const Route = createFileRoute('/archive')({
  component: () => (
    <EngLayout>
      <ArchivePage />
    </EngLayout>
  ),
})
