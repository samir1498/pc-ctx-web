import { createFileRoute } from '@tanstack/react-router'
import { HubLayout } from '../components/HubLayout'
import { SettingsPage } from '../pages/hub/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: () => (
    <HubLayout>
      <SettingsPage />
    </HubLayout>
  ),
})
