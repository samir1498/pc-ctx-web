import { useNavigate } from '@tanstack/react-router'
import { MarkdownContent } from '../../components/MarkdownContent'
import { Shots } from '../../components/Shots'
import { useProjectItem, useProjects } from '../../hooks/useContext'
import { shotsOf } from '../../lib/hub'
import { isPlainAudience, stripCodes } from '../../lib/plain'

export function ReportPage({ project, slug }: { project: string; slug: string }) {
  const navigate = useNavigate()
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)
  const { data: item, isLoading, error } = useProjectItem(project, 'reports', slug)

  if (isLoading) return <div className="pad-x py-6 text-sm text-muted">Loading…</div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {error.message}</div>
  if (!item) return <div className="pad-x py-6 text-sm text-muted">Report not found.</div>

  const title = String(item.frontmatter?.title ?? item.slug)
  const body = plain ? stripCodes(item.body) : item.body

  return (
    <div className="animate-fade-in pad-x py-7">
      <button
        onClick={() => navigate({ to: '/p/$project', params: { project } })}
        className="cursor-pointer font-mono text-2xs text-muted hover:text-foreground"
      >
        ← {summary?.name ?? project}
      </button>
      <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-[-0.03em]">{plain ? stripCodes(title) : title}</h1>
      <div className="mt-6">
        <MarkdownContent body={body} />
      </div>
      <Shots shots={shotsOf(item.frontmatter)} />
    </div>
  )
}
