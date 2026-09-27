import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '../components/Dashboard'
import { EngLayout } from '../components/EngLayout'

export const Route = createFileRoute('/dashboard')({
  component: () => (
    <EngLayout>
      <Dashboard />
    </EngLayout>
  ),
})
