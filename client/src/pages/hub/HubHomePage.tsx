import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MarkdownContent } from '../../components/MarkdownContent'
import { Shots } from '../../components/Shots'
import { useProjectFolder, useProjectItem, useProjects } from '../../hooks/useContext'
import { firstParagraphs, planBucket, planProgress, planTitle, shotsOf } from '../../lib/hub'
import { isPlainAudience, stripCodes } from '../../lib/plain'

export function HubHomePage({ project }: { project: string }) {
  const navigate = useNavigate()
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)

  const now = useProjectItem(project, 'progress', 'now')
  const standups = useProjectFolder(project, 'standups', false)
  const reports = useProjectFolder(project, 'reports', true)
  const plans = useProjectFolder(project, 'plans', true)

  const lede = useMemo(() => {
    if (!now.data?.body) return ''
    const text = firstParagraphs(now.data.body)
    return plain ? stripCodes(text) : text
  }, [now.data, plain])

  const latestStandup = standups.data?.[0]
  const reportRows = (reports.data ?? []).slice(0, 6)

  const activePlans = useMemo(
    () =>
      (plans.data ?? [])
        .filter((p) => planBucket(p) === 'active')
        .sort((a, b) => planProgress(b).pct - planProgress(a).pct),
    [plans.data],
  )
  const pausedCount = (plans.data ?? []).filter((p) => planBucket(p) === 'paused').length

  if (now.isLoading && plans.isLoading) return <div className="pad-x py-6 text-sm text-muted">Loading…</div>

  return (
    <div className="animate-fade-in pad-x py-7">
      <h1 className="text-3xl font-bold tracking-[-0.03em]">
        {summary?.name ?? project}
        {plain && (
          <span className="ml-2.5 align-middle font-mono text-2xs font-normal text-green" style={{ border: '1px solid rgba(34,197,94,.4)', padding: '2px 7px' }}>
            plain view
          </span>
        )}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          <h2 className="mb-2 mt-0 text-sm font-semibold">Where it stands</h2>
          {lede ? (
            <MarkdownContent body={lede} />
          ) : (
            <p className="text-sm text-faint">No progress notes yet.</p>
          )}

          <div className="mt-7 flex items-center gap-2">
            <h2 className="m-0 text-sm font-semibold">Latest standup</h2>
            {latestStandup && (
              <button
                onClick={() => navigate({ to: '/p/$project/standups/$slug', params: { project, slug: latestStandup.slug } })}
                className="font-mono text-2xs text-secondary hover:text-foreground"
              >
                open
              </button>
            )}
          </div>
          {latestStandup ? (
            <Shots shots={shotsOf(latestStandup.frontmatter)} />
          ) : (
            <p className="mt-2 text-sm text-faint">No standups yet.</p>
          )}

          <h2 className="mb-2 mt-7 text-sm font-semibold">Reports</h2>
          {reportRows.length > 0 ? (
            <div>
              {reportRows.map((r) => (
                <div key={r.slug} className="flex items-center justify-between gap-3 border-b border-faintline py-2.5">
                  <button
                    onClick={() => navigate({ to: '/p/$project/reports/$slug', params: { project, slug: r.slug } })}
                    className="cursor-pointer text-left text-sm text-secondary hover:text-foreground"
                  >
                    {plain ? stripCodes(String(r.frontmatter?.title ?? r.slug)) : (r.frontmatter?.title ?? r.slug)}
                  </button>
                  {/* frontmatter `date:` (unquoted YYYY-MM-DD) parses as a Date, serialized as an ISO string; keep just the date part. */}
                  <span className="whitespace-nowrap font-mono text-2xs text-faint">{String(r.frontmatter?.date ?? '').slice(0, 10)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-faint">No reports yet.</p>
          )}
        </div>

        <div>
          <h2 className="mb-2 mt-0 text-sm font-semibold">Moving now</h2>
          {activePlans.length > 0 ? (
            <div>
              {activePlans.slice(0, 8).map((p) => {
                const pr = planProgress(p)
                return (
                  <div key={p.slug} className="flex items-center gap-2.5 border-b border-faintline py-2.5">
                    <button
                      onClick={() => navigate({ to: '/p/$project/plan/$slug', params: { project, slug: p.slug } })}
                      className="flex-1 cursor-pointer text-left text-sm font-medium hover:text-foreground"
                    >
                      {plain ? stripCodes(planTitle(p)) : planTitle(p)}
                    </button>
                    {pr.total > 0 && (
                      <>
                        <span className="h-[3px] w-24 bg-line">
                          <span className="block h-full bg-green" style={{ width: `${pr.pct}%` }} />
                        </span>
                        <span className="w-10 text-right font-mono text-2xs text-faint">
                          {pr.done}/{pr.total}
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
              {activePlans.length > 8 && (
                <button
                  onClick={() => navigate({ to: '/p/$project/plans', params: { project } })}
                  className="mt-2.5 font-mono text-2xs text-secondary hover:text-foreground"
                >
                  All {activePlans.length} in progress →
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-faint">Nothing moving right now.</p>
          )}

          <h2 className="mb-2 mt-7 text-sm font-semibold">Waiting</h2>
          <p className="text-sm text-muted">
            {pausedCount} paused plan{pausedCount === 1 ? '' : 's'}.{' '}
            <button
              onClick={() => navigate({ to: '/p/$project/plans', params: { project } })}
              className="font-mono text-2xs text-secondary hover:text-foreground"
            >
              see board
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
