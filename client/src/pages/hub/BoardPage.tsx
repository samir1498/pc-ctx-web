import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Crumbs } from '../../components/Crumbs'
import { useProjectFolder, useProjectFolderList, useProjects } from '../../hooks/useContext'
import { docDate, planBucket, planProgress, planTitle, shortDate } from '../../lib/hub'
import { paths } from '../../lib/nav'
import { isPlainAudience, stripCodes } from '../../lib/plain'
import type { ContextItem } from '../../types'

const COLUMNS = [
  ['active', 'In progress'],
  ['paused', 'Waiting'],
  ['done', 'Done'],
] as const

function byNewest(a: ContextItem, b: ContextItem): number {
  return (docDate(b) ?? '').localeCompare(docDate(a) ?? '')
}

export function BoardPage({ project }: { project: string }) {
  const { data: projects } = useProjects()
  const summary = projects?.find((p) => p.id === project)
  const plain = isPlainAudience(summary?.audience)

  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const plans = useProjectFolder(project, 'plans', true)
  const archivedList = useProjectFolderList(project, 'plans-archived', true)
  const archived = useProjectFolder(project, 'plans-archived', true, showArchived)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => (plans.data ?? []).filter((p) => !q || planTitle(p).toLowerCase().includes(q)), [plans.data, q])
  const filteredArchived = useMemo(() => (archived.data ?? []).filter((p) => !q || planTitle(p).toLowerCase().includes(q)), [archived.data, q])

  function title(item: ContextItem): string {
    return plain ? stripCodes(planTitle(item)) : planTitle(item)
  }

  function Card({ p, showProgress = true }: { p: ContextItem; showProgress?: boolean }) {
    const pr = planProgress(p)
    const when = shortDate(docDate(p))
    return (
      <Link to="/p/$project/plan/$slug" params={{ project, slug: p.slug }} className="block rounded-md border border-border bg-panel px-3 py-2.5 no-underline transition-colors hover:border-outline">
        <div className="text-[0.925rem] font-medium leading-snug">{title(p)}</div>
        <div className="mt-2 flex items-center gap-2 font-mono text-2xs text-dim">
          {showProgress && pr.total > 0 ? (
            <>
              <span className="bar flex-1">
                <span style={{ width: `${pr.pct}%` }} />
              </span>
              <span>
                {pr.done}/{pr.total}
              </span>
            </>
          ) : (
            <span className="flex-1 text-fainter">{showProgress ? 'no tasks' : ''}</span>
          )}
          {when && <span>{when}</span>}
        </div>
      </Link>
    )
  }

  const columnCount = COLUMNS.length + (showArchived ? 1 : 0)

  return (
    <div className="reader-wide animate-fade-in">
      <Crumbs items={[{ label: summary?.name ?? project, to: paths.home(project) }, { label: 'Plans' }]} />
      <h1 className="page-title">All plans</h1>
      <p className="lede">Every plan in this store by where it stands. Open one to read its notes and tasks.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title"
          aria-label="Filter plans by title"
          className="w-64 rounded-md border border-line bg-input px-3 py-1.5 text-sm text-foreground placeholder:text-faint focus:border-outline focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm ${showArchived ? 'border-foreground bg-foreground text-page' : 'border-line bg-panel text-muted hover:text-foreground'}`}
        >
          {showArchived ? 'Hide' : 'Show'} archived ({archivedList.data?.length ?? 0})
        </button>
      </div>

      {plans.isLoading && <p className="mt-6 text-sm text-muted">Loading…</p>}
      {plans.error && <p className="mt-6 text-sm text-red">Could not load plans: {plans.error.message}</p>}

      <div className={`mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 ${columnCount >= 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        {COLUMNS.map(([key, label]) => {
          const list = filtered.filter((p) => planBucket(p) === key).sort(byNewest)
          return (
            <section key={key} id={key} className="min-w-0">
              <header className="flex items-baseline justify-between border-b border-line pb-2">
                <h2 className="m-0 text-sm font-semibold">{label}</h2>
                <span className="font-mono text-xs text-dim">{list.length}</span>
              </header>
              <div className="flex flex-col gap-2 pt-3">
                {list.map((p) => (
                  <Card key={p.slug} p={p} />
                ))}
                {list.length === 0 && !plans.isLoading && <p className="py-2 text-sm text-faint">Nothing here.</p>}
              </div>
            </section>
          )
        })}

        {showArchived && (
          <section id="archived" className="min-w-0">
            <header className="flex items-baseline justify-between border-b border-line pb-2">
              <h2 className="m-0 text-sm font-semibold">Archived</h2>
              <span className="font-mono text-xs text-dim">{filteredArchived.length}</span>
            </header>
            <div className="flex flex-col gap-2 pt-3">
              {[...filteredArchived].sort(byNewest).map((p) => (
                <Card key={p.slug} p={p} showProgress={false} />
              ))}
              {archived.isLoading && <p className="py-2 text-sm text-faint">Loading…</p>}
              {filteredArchived.length === 0 && !archived.isLoading && <p className="py-2 text-sm text-faint">Nothing here.</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
