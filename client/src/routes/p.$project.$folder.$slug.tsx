import { createFileRoute } from '@tanstack/react-router'
import { PageState } from '../components/Crumbs'
import { DocPage } from '../pages/hub/DocPage'
import { isFolder } from '../types'

export const Route = createFileRoute('/p/$project/$folder/$slug')({
  component: RouteComponent,
})

function RouteComponent() {
  const { project, folder, slug } = Route.useParams()
  if (!isFolder(folder)) return <PageState>There is no section called “{folder}”.</PageState>
  return <DocPage project={project} folder={folder} slug={slug} />
}
