import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useProjectFolder, useProjectFolderList, useProjects } from '../../hooks/useContext'
import { planBucket, planProgress, planTitle } from '../../lib/hub'
import { isPlainAudience, stripCodes } from '../../lib/plain'
import type { ContextItem } from '../../types'

const COLUMNS = [
  ['active', 'In progress'],
  ['paused', 'Paused'],
  ['done', 'Done, not archived'],
] as const

export function BoardPage({ project }: { project: string }) {
  const { data: projects } = useProjects()
  const plain = isPlainAudience(projects?.find((p) => p.id === project)?.audience)

  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const plans = useProjectFolder(project, 'plans', true)
  const archivedList = useProjectFolderList(project, 'plans-archived', true)
  const archived = useProjectFolder(project, 'plans-archived', true, showArchived)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () => (plans.data ?? []).filter((p) => !q || planTitle(p).toLowerCase().includes(q)),
    [plans.data, q],
  )
  const filteredArchived = useMemo(
    () => (archived.data ?? []).filter((p) => !q || planTitle(p).toLowerCase().includes(q)),
    [archived.data, q],
  )

  function title(item: ContextItem): string {
    return plain ? stripCodes(planTitle(item)) : planTitle(item)
  }

  return (
    <div className="animate-fade-in pad-x py-7">
      <h1 className="text-3xl font-bold tracking-[-0.03em]">All plans</h1>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plan titles"
          className="w-60 border border-line bg-input px-3 py-2 font-mono text-xs text-foreground placeholder:text-faint focus:border-outline focus:outline-none"
        />
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`border px-2.5 py-2 font-mono text-2xs ${showArchived ? 'border-foreground font-semibold' : 'border-line text-faint'}`}
        >
          {showArchived ? 'Hide' : 'Show'} archived ({archivedList.data?.length ?? 0})
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(([key, label]) => {
          const list = filtered.filter((p) => planBucket(p) === key).sort((a, b) => (b.frontmatter?.created ? String(b.frontmatter.created) : '').localeCompare(String(a.frontmatter?.created ?? '')))
          return (
            <div key={key} className="border border-border bg-panel">
              <header className="flex items-center justify-between border-b border-border px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.06em] text-muted">
                <span>{label}</span>
                <span>{list.length}</span>
              </header>
              <div className="flex max-h-[32rem] flex-col gap-1.5 overflow-auto p-1.5">
                {list.map((p) => {
                  const pr = planProgress(p)
                  return (
                    <Link
                      key={p.slug}
                      to="/p/$project/plan/$slug"
                      params={{ project, slug: p.slug }}
                      className="v2row block border border-faintline bg-input px-2.5 py-2 text-left no-underline"
                    >
                      <div className="text-sm font-medium">{title(p)}</div>
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-2xs text-faint">
                        {pr.total > 0 ? (
                          <>
                            <span className="h-[3px] flex-1 bg-line">
                              <span className="block h-full bg-green" style={{ width: `${pr.pct}%` }} />
                            </span>
                            <span>
                              {pr.done}/{pr.total}
                            </span>
                          </>
                        ) : (
                          <span>no tasks</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
                {list.length === 0 && <div className="p-2.5 font-mono text-2xs text-dim">nothing here</div>}
              </div>
            </div>
          )
        })}

        {showArchived && (
          <div className="border border-border bg-panel">
            <header className="flex items-center justify-between border-b border-border px-3 py-2.5 font-mono text-2xs uppercase tracking-[0.06em] text-muted">
              <span>Archived</span>
              <span>{filteredArchived.length}</span>
            </header>
            <div className="flex max-h-[32rem] flex-col gap-1.5 overflow-auto p-1.5">
              {filteredArchived.map((p) => (
                <Link
                  key={p.slug}
                  to="/p/$project/plan/$slug"
                  params={{ project, slug: p.slug }}
                  className="v2row block border border-faintline bg-input px-2.5 py-2 text-left no-underline"
                >
                  <div className="text-sm font-medium">{title(p)}</div>
                </Link>
              ))}
              {filteredArchived.length === 0 && <div className="p-2.5 font-mono text-2xs text-dim">nothing here</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
