import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { IdeasPage } from '../pages/IdeasPage'

export const Route = createFileRoute('/ideas')({
  component: () => (
    <EngLayout>
      <IdeasPage />
    </EngLayout>
  ),
})
