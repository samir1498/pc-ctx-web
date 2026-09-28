import { Crumbs, PageState } from '../../components/Crumbs'
import { MarkdownContent } from '../../components/MarkdownContent'
import { TaskList } from '../../components/TaskList'
import { useProjectPlan, useProjects } from '../../hooks/useContext'
import { formatDate, planBucket, planProgress, planTitle, splitLeadingHeading } from '../../lib/hub'
import { paths } from '../../lib/nav'
import { isPlainAudience, stripCodes } from '../../lib/plain'

const BUCKET_LABEL: Record<string, string> = {
  active: 'in progress',
  paused: 'waiting',
  done: 'done',
  archived: 'archived',
  cancelled: 'cancelled',
}

export function HubPlanPage({ project, slug }: { project: string; slug: string }) {
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)
  const { data: item, archived, isLoading, error } = useProjectPlan(project, slug)

  if (isLoading) return <PageState>Loading…</PageState>
  if (error) return <PageState tone="error">Could not load this plan: {error.message}</PageState>
  if (!item) return <PageState>There is no plan called “{slug}” in this store.</PageState>

  const fm = item.frontmatter
  const pr = planProgress(item)
  const status = archived ? 'archived' : String(fm.status ?? planBucket(item) ?? 'active')
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : []
  const tldr = typeof fm.tldr === 'string' ? (plain ? stripCodes(fm.tldr) : fm.tldr) : ''
  // A body that opens with the plan's own title as a heading shows it once.
  const { heading, rest } = splitLeadingHeading(item.body ?? '')
  const rawBody = heading && heading === planTitle(item) ? rest : (item.body ?? '')
  const body = rawBody ? (plain ? stripCodes(rawBody) : rawBody) : ''
  const started = formatDate(fm.created)

  return (
    <article className="reader animate-fade-in">
      <Crumbs items={[{ label: summary?.name ?? project, to: paths.home(project) }, { label: 'Plans', to: paths.board(project) }, { label: BUCKET_LABEL[status] ?? status }]} />
      <h1 className="page-title">{plain ? stripCodes(planTitle(item)) : planTitle(item)}</h1>
      {tldr && <p className="lede">{tldr}</p>}

      <div className="meta-row items-center">
        <span className="pill" data-tone={status}>
          {BUCKET_LABEL[status] ?? status}
        </span>
        {started && <span>started {started}</span>}
        {pr.total > 0 && (
          <span className="flex items-center gap-2">
            <span className="bar w-24">
              <span style={{ width: `${pr.pct}%` }} />
            </span>
            {pr.done} of {pr.total} done
          </span>
        )}
        {!plain && <span className="text-faint">{item.slug}</span>}
      </div>

      {body && (
        <section className="mt-8">
          <MarkdownContent body={body} />
        </section>
      )}

      {tasks.length > 0 && (
        <section>
          <h2 className="section-title">Tasks{pr.total ? ` · ${pr.done} of ${pr.total} done` : ''}</h2>
          <TaskList tasks={tasks} showIds={!plain} />
        </section>
      )}

      {!body && tasks.length === 0 && !tldr && <p className="mt-8 text-sm text-muted">This plan has a title and nothing else yet.</p>}
    </article>
  )
}
