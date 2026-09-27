import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { ReferencesPage } from '../pages/ReferencesPage'

export const Route = createFileRoute('/references')({
  component: () => (
    <EngLayout>
      <ReferencesPage />
    </EngLayout>
  ),
})
