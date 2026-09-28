import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { MarkdownContent } from '../../components/MarkdownContent'
import { Shots } from '../../components/Shots'
import { PageState } from '../../components/Crumbs'
import { useProjectCounts, useProjectFolder, useProjectItem, useProjects } from '../../hooks/useContext'
import { displayTitle, docDate, docTitle, firstParagraphs, planBucket, planProgress, planTitle, shortDate, shotsOf, splitLeadingHeading } from '../../lib/hub'
import { paths } from '../../lib/nav'
import { isPlainAudience, stripCodes } from '../../lib/plain'
import type { ContextItem, Folder } from '../../types'
import { FOLDER_SINGULAR } from '../../types'

function PlanRow({ project, plan, plain }: { project: string; plan: ContextItem; plain: boolean }) {
  const pr = planProgress(plan)
  const title = plain ? stripCodes(planTitle(plan)) : planTitle(plan)
  return (
    <li>
      <Link to="/p/$project/plan/$slug" params={{ project, slug: plan.slug }} className="row-link !grid-cols-[minmax(0,1fr)_auto] items-center">
        <span className="what">{title}</span>
        {pr.total > 0 ? (
          <span className="flex items-center gap-2 font-mono text-2xs text-dim">
            <span className="bar w-20">
              <span style={{ width: `${pr.pct}%` }} />
            </span>
            <span className="w-10 text-right">
              {pr.done}/{pr.total}
            </span>
          </span>
        ) : (
          <span className="font-mono text-2xs text-fainter">no tasks</span>
        )}
      </Link>
    </li>
  )
}

function LatestDoc({ project, folder, item, plain, label }: { project: string; folder: Folder; item: ContextItem; plain: boolean; label: string }) {
  const rawTitle = docTitle(item)
  const title = displayTitle(item, FOLDER_SINGULAR[folder])
  const { heading, rest } = splitLeadingHeading(item.body ?? '')
  const bodyText = firstParagraphs(heading === rawTitle ? rest : (item.body ?? ''), 2)
  const excerpt = plain ? stripCodes(bodyText) : bodyText
  return (
    <section>
      <h2 className="section-title">{label}</h2>
      <p className="m-0 flex flex-wrap items-baseline gap-x-3">
        <Link to="/p/$project/$folder/$slug" params={{ project, folder, slug: item.slug }} className="text-[1.05rem] font-semibold no-underline hover:underline">
          {plain ? stripCodes(title) : title}
        </Link>
        <span className="font-mono text-xs text-dim">{shortDate(docDate(item))}</span>
      </p>
      <Shots shots={shotsOf(item.frontmatter)} />
      {excerpt && <MarkdownContent body={excerpt} className="mt-2 text-[0.95rem]" />}
      <p className="mt-2">
        <Link to="/p/$project/$folder/$slug" params={{ project, folder, slug: item.slug }} className="font-mono text-xs text-accent no-underline hover:underline">
          Read it →
        </Link>
      </p>
    </section>
  )
}

export function HubHomePage({ project }: { project: string }) {
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)

  const counts = useProjectCounts(project)
  const now = useProjectItem(project, 'progress', 'now')
  const plans = useProjectFolder(project, 'plans', true)
  const standups = useProjectFolder(project, 'standups', false, (counts.data?.standups ?? 0) > 0)
  const reports = useProjectFolder(project, 'reports', true, (counts.data?.reports ?? 0) > 0)

  const lede = useMemo(() => {
    if (!now.data?.body) return ''
    const { rest } = splitLeadingHeading(now.data.body)
    const text = firstParagraphs(rest || now.data.body, 2)
    return plain ? stripCodes(text) : text
  }, [now.data, plain])

  const buckets = useMemo(() => {
    const list = plans.data ?? []
    const active = list.filter((p) => planBucket(p) === 'active').sort((a, b) => planProgress(b).pct - planProgress(a).pct)
    const paused = list.filter((p) => planBucket(p) === 'paused')
    const done = list.filter((p) => planBucket(p) === 'done')
    return { active, paused, done }
  }, [plans.data])

  const latestStandup = standups.data?.[0]
  const reportRows = (reports.data ?? []).slice(0, 5)

  if (plans.isLoading && now.isLoading) return <PageState>Loading…</PageState>
  if (plans.error) return <PageState tone="error">Could not load this project: {plans.error.message}</PageState>

  const facts: string[] = []
  if (buckets.active.length) facts.push(`${buckets.active.length} plan${buckets.active.length === 1 ? '' : 's'} in progress`)
  if (buckets.paused.length) facts.push(`${buckets.paused.length} waiting`)
  if (buckets.done.length) facts.push(`${buckets.done.length} done`)

  return (
    <article className="reader animate-fade-in">
      <p className="crumb">
        <span>{summary?.name ?? project}</span>
        <span aria-hidden="true">/</span>
        <span className="text-muted">Overview</span>
      </p>
      <h1 className="page-title">{summary?.name ?? project}</h1>
      {facts.length > 0 && <p className="meta-row">{facts.join(' · ')}</p>}

      <section>
        <h2 className="section-title">Where it stands</h2>
        {lede ? (
          <>
            <MarkdownContent body={lede} />
            <p className="mt-2">
              <Link to="/p/$project/$folder/$slug" params={{ project, folder: 'progress', slug: 'now' }} className="font-mono text-xs text-accent no-underline hover:underline">
                Full status →
              </Link>
            </p>
          </>
        ) : now.isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <p className="text-sm text-muted">This store has no progress/now.md yet.</p>
        )}
      </section>

      <section>
        <h2 className="section-title">Moving now</h2>
        {plans.isLoading ? (
          <p className="text-sm text-muted">Loading plans…</p>
        ) : buckets.active.length > 0 ? (
          <>
            <ul className="rows">
              {buckets.active.slice(0, 8).map((p) => (
                <PlanRow key={p.slug} project={project} plan={p} plain={plain} />
              ))}
            </ul>
            {buckets.active.length > 8 && (
              <p className="mt-2">
                <Link to="/p/$project/plans" params={{ project }} className="font-mono text-xs text-accent no-underline hover:underline">
                  All {buckets.active.length} in progress →
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Nothing is marked in progress.</p>
        )}
      </section>

      {buckets.paused.length > 0 && (
        <section>
          <h2 className="section-title">Waiting</h2>
          <ul className="rows">
            {buckets.paused.slice(0, 6).map((p) => (
              <PlanRow key={p.slug} project={project} plan={p} plain={plain} />
            ))}
          </ul>
          {buckets.paused.length > 6 && (
            <p className="mt-2">
              <Link to="/p/$project/plans" params={{ project }} className="font-mono text-xs text-accent no-underline hover:underline">
                All {buckets.paused.length} waiting →
              </Link>
            </p>
          )}
        </section>
      )}

      {latestStandup && <LatestDoc project={project} folder="standups" item={latestStandup} plain={plain} label="Latest standup" />}

      {reportRows.length > 0 && (
        <section>
          <h2 className="section-title">Reports</h2>
          <ul className="rows">
            {reportRows.map((r) => (
              <li key={r.slug}>
                <Link to="/p/$project/$folder/$slug" params={{ project, folder: 'reports', slug: r.slug }} className="row-link">
                  <span className="when">{shortDate(docDate(r))}</span>
                  <span className="what">{plain ? stripCodes(docTitle(r)) : docTitle(r)}</span>
                  {typeof r.frontmatter?.tldr === 'string' && <span className="why">{plain ? stripCodes(r.frontmatter.tldr) : r.frontmatter.tldr}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {(counts.data?.reports ?? 0) > reportRows.length && (
            <p className="mt-2">
              <Link to={paths.folder(project, 'reports')} className="font-mono text-xs text-accent no-underline hover:underline">
                All {counts.data?.reports} reports →
              </Link>
            </p>
          )}
        </section>
      )}
    </article>
  )
}
