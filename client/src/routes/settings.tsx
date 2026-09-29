import { createFileRoute } from '@tanstack/react-router'
import { HubShell } from '../components/HubShell'
import { SettingsPage } from '../pages/hub/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: () => (
    <HubShell>
      <SettingsPage />
    </HubShell>
  ),
})
