import { createFileRoute } from '@tanstack/react-router'
import { EngLayout } from '../components/EngLayout'
import { GraphPage } from '../pages/GraphPage'

export const Route = createFileRoute('/graph')({
  component: () => (
    <EngLayout>
      <GraphPage />
    </EngLayout>
  ),
})
