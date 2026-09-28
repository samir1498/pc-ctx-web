import { createFileRoute } from '@tanstack/react-router'
import { PageState } from '../components/Crumbs'
import { FolderPage } from '../pages/hub/FolderPage'
import { isFolder } from '../types'

export const Route = createFileRoute('/p/$project/$folder/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, folder } = Route.useParams()
  if (!isFolder(folder)) return <PageState>There is no section called “{folder}”.</PageState>
  return <FolderPage project={project} folder={folder} />
}
