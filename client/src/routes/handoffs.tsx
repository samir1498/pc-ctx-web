import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { HandoffsPage } from '../pages/HandoffsPage'

export const Route = createFileRoute('/handoffs')({
  component: () => (
    <EngLayout>
      <HandoffsPage />
    </EngLayout>
  ),
})
