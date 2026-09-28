import { Link } from '@tanstack/react-router'
import { Crumbs, PageState } from '../../components/Crumbs'
import { AcceptanceList, PlanRef, ReferenceList } from '../../components/FrontmatterExtras'
import { MarkdownContent } from '../../components/MarkdownContent'
import { Shots } from '../../components/Shots'
import { TaskList } from '../../components/TaskList'
import { useProjectItem, useProjects } from '../../hooks/useContext'
import { usePlanLookup } from '../../hooks/usePlanLookup'
import { displayTitle, docDate, docTitle, planProgress, planTitle, shortDate, shotsOf, splitLeadingHeading } from '../../lib/hub'
import { paths } from '../../lib/nav'
import { isPlainAudience, stripCodes } from '../../lib/plain'
import { statusColor, taskMark } from '../../lib/ui'
import type { Folder } from '../../types'
import { FOLDER_LABELS, FOLDER_SINGULAR } from '../../types'

interface RoadmapEntry {
  ref: string
  status?: string
  note?: string
}

function isRoadmapEntry(v: unknown): v is RoadmapEntry {
  return typeof v === 'object' && v !== null && typeof (v as { ref?: unknown }).ref === 'string'
}

// A roadmap's entries point at plans by their frontmatter slug (not the file
// name), so each row resolves against the plans folder before it links.
function RoadmapEntries({ project, entries, plain }: { project: string; entries: unknown[]; plain: boolean }) {
  const find = usePlanLookup(project)
  const rows = entries.filter(isRoadmapEntry)
  if (rows.length === 0) return null
  return (
    <section>
      <h2 className="section-title">Milestones</h2>
      <ol className="m-0 list-none p-0">
        {rows.map((e, i) => {
          const plan = find(e.ref)
          const color = statusColor(e.status)
          const label = plan ? (plain ? stripCodes(planTitle(plan)) : planTitle(plan)) : e.ref
          return (
            <li key={`${e.ref}-${i}`} className="flex items-start gap-3 border-b border-faintline py-3 last:border-b-0">
              <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-sm leading-6" style={{ color }} aria-hidden="true">
                {taskMark(e.status === 'in-progress' ? 'in-progress' : e.status)}
              </span>
              <span className="min-w-0 flex-1">
                {plan ? (
                  <Link to="/p/$project/plan/$slug" params={{ project, slug: plan.slug }} className="font-medium no-underline hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span className="font-medium">{label}</span>
                )}
                {e.note && <span className="mt-0.5 block text-sm leading-relaxed text-muted">{plain ? stripCodes(e.note) : e.note}</span>}
              </span>
              <span className="shrink-0 pt-1 font-mono text-2xs" style={{ color }}>
                {e.status ?? 'planned'}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function DocPage({ project, folder, slug }: { project: string; folder: Folder; slug: string }) {
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)
  const { data: item, isLoading, error } = useProjectItem(project, folder, slug)
  const lookup = usePlanLookup(project, ['loops', 'archive'].includes(folder))

  if (isLoading) return <PageState>Loading…</PageState>
  if (error) return <PageState tone="error">Could not load this page: {error.message}</PageState>
  if (!item) return <PageState>There is no {FOLDER_SINGULAR[folder].toLowerCase()} called “{slug}” in this store.</PageState>

  const fm = item.frontmatter ?? {}
  const rawTitle = docTitle(item)
  const title = displayTitle(item, FOLDER_SINGULAR[folder])
  const { heading, rest } = splitLeadingHeading(item.body ?? '')
  const rawBody = heading && heading === rawTitle ? rest : (item.body ?? '')
  const body = plain ? stripCodes(rawBody) : rawBody
  const tldr = typeof fm.tldr === 'string' ? (plain ? stripCodes(fm.tldr) : fm.tldr) : ''
  const date = docDate(item)
  const status = typeof fm.status === 'string' ? fm.status : null
  const tags = Array.isArray(fm.tags) ? fm.tags.filter((t): t is string => typeof t === 'string') : []
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : []
  const entries = Array.isArray(fm.entries) ? fm.entries : []
  const period = typeof fm.period === 'string' ? fm.period : null
  const pr = planProgress(item)
  // Loops and archive pages name the plan they ran or came from.
  const planRef = [fm.plan, fm.ref_plan].find((v): v is string => typeof v === 'string' && v.trim() !== '') ?? null
  const roadmap = typeof fm.roadmap === 'string' ? fm.roadmap : null
  const superseded = typeof fm.superseded_by === 'string' ? fm.superseded_by : null
  const shipped = typeof fm.shipped === 'string' ? fm.shipped : null
  const repo = [fm.repo, fm.branch].filter((v): v is string => typeof v === 'string').join(' @ ')
  const hasAcceptance = Array.isArray(fm.acceptance) && fm.acceptance.length > 0
  const hasReferences = !plain && Array.isArray(fm.references) && fm.references.length > 0
  const empty = !body.trim() && entries.length === 0 && tasks.length === 0 && !hasAcceptance

  return (
    <article className="reader animate-fade-in">
      <Crumbs items={[{ label: summary?.name ?? project, to: paths.home(project) }, { label: FOLDER_LABELS[folder], to: paths.folder(project, folder) }, { label: FOLDER_SINGULAR[folder] }]} />
      <h1 className="page-title">{plain ? stripCodes(title) : title}</h1>
      {tldr && <p className="lede">{tldr}</p>}
      <div className="meta-row items-center">
        {date && <span>{shortDate(date)}</span>}
        {status && (
          <span className="pill" data-tone={status}>
            {status}
          </span>
        )}
        {period && <span>{period}</span>}
        {planRef && (
          <span>
            plan <PlanRef project={project} value={planRef} lookup={lookup} />
          </span>
        )}
        {!plain && roadmap && <span>roadmap {roadmap}</span>}
        {superseded && <span>superseded by {superseded}</span>}
        {shipped && <span>shipped {shipped}</span>}
        {!plain && repo && <span>{repo}</span>}
        {tags.map((t) => (
          <span key={t} className="text-faint">
            #{t}
          </span>
        ))}
        {!plain && <span className="text-faint">{item.path}</span>}
      </div>

      <Shots shots={shotsOf(item.frontmatter)} />

      {body.trim() ? (
        <section className="mt-8">
          <MarkdownContent body={body} />
        </section>
      ) : empty ? (
        <p className="mt-8 text-sm text-muted">This page has a title and nothing else yet.</p>
      ) : null}

      {entries.length > 0 && <RoadmapEntries project={project} entries={entries} plain={plain} />}

      {tasks.length > 0 && (
        <section>
          <h2 className="section-title">Tasks{pr.total ? ` · ${pr.done} of ${pr.total} done` : ''}</h2>
          <TaskList tasks={tasks} plain={plain} />
        </section>
      )}

      {hasAcceptance && <AcceptanceList value={fm.acceptance} plain={plain} />}
      {hasReferences && <ReferenceList project={project} value={fm.references} />}
    </article>
  )
}
