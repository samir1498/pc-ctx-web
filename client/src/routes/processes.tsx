import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { ProcessesPage } from '../pages/ProcessesPage'

export const Route = createFileRoute('/processes')({
  component: () => (
    <EngLayout>
      <ProcessesPage />
    </EngLayout>
  ),
})
