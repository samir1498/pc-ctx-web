import { useNavigate } from '@tanstack/react-router'
import { MarkdownContent } from '../../components/MarkdownContent'
import { TaskList } from '../../components/TaskList'
import { useProjectPlan, useProjects } from '../../hooks/useContext'
import { formatDate, planBucket, planProgress, planTitle } from '../../lib/hub'
import { isPlainAudience, stripCodes } from '../../lib/plain'

export function HubPlanPage({ project, slug }: { project: string; slug: string }) {
  const navigate = useNavigate()
  const { data: projects } = useProjects()
  const plain = isPlainAudience(projects?.find((p) => p.id === project)?.audience)
  const { data: item, archived, isLoading, error } = useProjectPlan(project, slug)

  if (isLoading) return <div className="pad-x py-6 text-sm text-muted">Loading…</div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {error.message}</div>
  if (!item) return <div className="pad-x py-6 text-sm text-muted">Plan not found.</div>

  const fm = item.frontmatter
  const pr = planProgress(item)
  const bucket = archived ? 'archived' : (planBucket(item) ?? 'active')
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : []
  const tldr = fm.tldr ? (plain ? stripCodes(fm.tldr) : fm.tldr) : ''
  const body = item.body ? (plain ? stripCodes(item.body) : item.body) : ''

  return (
    <div className="animate-fade-in pad-x py-7">
      <button
        onClick={() => navigate({ to: '/p/$project', params: { project } })}
        className="cursor-pointer font-mono text-2xs text-muted hover:text-foreground"
      >
        ← {projects?.find((p) => p.id === project)?.name ?? project}
      </button>

      <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-[-0.03em]">{planTitle(item)}</h1>
      {tldr && <p className="mt-3 max-w-2xl text-base leading-relaxed text-secondary">{tldr}</p>}

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 font-mono text-2xs text-faint">
        <span>{bucket}</span>
        <span>·</span>
        <span>started {formatDate(fm.created)}</span>
        {pr.total > 0 && (
          <>
            <span>·</span>
            <span>
              {pr.done} of {pr.total} done
            </span>
          </>
        )}
        {!plain && (
          <>
            <span>·</span>
            <span>{item.slug}</span>
          </>
        )}
      </div>

      {body && !plain && (
        <div className="mt-6">
          <MarkdownContent body={body} />
        </div>
      )}

      {tasks.length > 0 && (
        <>
          <h2 className="mb-1 mt-8 font-mono text-2xs tracking-[0.12em] text-dim">
            TASKS{pr.total ? ` · ${pr.done}/${pr.total}` : ''}
          </h2>
          <TaskList tasks={tasks} showIds={!plain} />
        </>
      )}
    </div>
  )
}
