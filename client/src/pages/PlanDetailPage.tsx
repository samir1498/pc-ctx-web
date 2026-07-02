import { useNavigate } from '@tanstack/react-router'
import { useItem, useFolder } from '../hooks/useContext'
import { MarkdownContent } from '../components/MarkdownContent'
import { TaskList } from '../components/TaskList'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { statusColor, priorityColor, taskCounts } from '../lib/ui'

interface PlanDetailPageProps {
  slug: string
}

const REF_COLOR: Record<string, string> = {
  plan: '#6366f1',
  research: '#22c55e',
  roadmap: '#f59e0b',
  url: '#3a3a40',
}

export function PlanDetailPage({ slug }: PlanDetailPageProps) {
  const navigate = useNavigate()
  const { data: item, isLoading, error } = useItem('plans', slug)
  const { data: allPlans } = useFolder('plans')

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>
  if (!item) return <div className="pad-x py-6 text-sm text-muted">Not found.</div>

  const fm = item.frontmatter
  const tc = taskCounts(item)
  const tasks = Array.isArray(fm.tasks) ? fm.tasks : []

  const planBySlug = new Map((allPlans ?? []).map((p) => [p.slug, p]))
  const outbound = (Array.isArray(fm.references) ? fm.references : [])
    .map((r) => {
      const idx = r.indexOf(':')
      const type = idx === -1 ? 'ref' : r.slice(0, idx)
      const target = idx === -1 ? r : r.slice(idx + 1)
      const tp = planBySlug.get(target)
      const desc = tp
        ? `[${tp.frontmatter?.status ?? '—'}] ${tp.frontmatter?.tldr ?? ''}`
        : type === 'url'
          ? 'external link'
          : type === 'research'
            ? 'research file'
            : '—'
      return { type, target, color: REF_COLOR[type] ?? '#3a3a40', desc, isPlan: Boolean(tp) }
    })

  const backlinks = (allPlans ?? []).filter(
    (p) => p.slug !== slug && Array.isArray(p.frontmatter?.references) && p.frontmatter.references.includes(`plan:${slug}`),
  )

  return (
    <div className="animate-fade-in">
      <div className="pad-x pt-6">
        <button
          onClick={() => navigate({ to: '/plans' })}
          className="cursor-pointer font-mono text-[11px] tracking-[0.04em] text-muted hover:text-foreground"
        >
          ← PLANS
        </button>
      </div>

      <div className="border-b border-border pad-x pb-6 pt-5">
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px]">
          <span className="font-semibold" style={{ color: priorityColor(fm.priority) }}>P{fm.priority ?? '—'}</span>
          <span className="text-fainter">/</span>
          <span className="text-muted">{fm.category ?? 'uncategorized'}</span>
          <span className="text-fainter">/</span>
          <span style={{ color: statusColor(fm.status) }}>[{fm.status ?? '—'}]</span>
          {fm.created && (
            <>
              <span className="text-fainter">/</span>
              <span className="text-dim">created {String(fm.created)}</span>
            </>
          )}
        </div>
        <h1 className="mt-4 max-w-[760px] text-[34px] font-bold tracking-[-0.03em]">{fm.title ?? slug}</h1>
        {fm.tldr && <p className="mt-3 max-w-[680px] text-[15px] leading-relaxed text-secondary">{fm.tldr}</p>}
      </div>

      <div className="flex flex-wrap gap-x-8 pad-x">
        <div className="flex-[999_1_0] min-w-[min(100%,50%)] py-[26px]">
          {item.body && <MarkdownContent body={item.body} />}

          {tasks.length > 0 && (
            <>
              <div className="mb-1 mt-8 font-mono text-[11px] tracking-[0.12em] text-dim">
                TASKS{tc ? ` · ${tc.done}/${tc.total}` : ''}
              </div>
              <TaskList tasks={tasks} />
            </>
          )}
        </div>

        <div className="flex-[1_1_18rem] py-[26px]">
          <div className="font-mono text-[11px] tracking-[0.12em] text-dim">REFERENCES ↗</div>
          <div className="mt-3">
            {outbound.length > 0 ? (
              outbound.map((r) => (
                <button
                  key={`${r.type}:${r.target}`}
                  disabled={!r.isPlan}
                  onClick={() => r.isPlan && navigate({ to: '/plan/$slug', params: { slug: r.target } })}
                  className={`block w-full border-t border-faintline py-2.5 text-left ${r.isPlan ? 'v2row cursor-pointer' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="border px-[5px] py-0.5 font-mono text-[9px] tracking-[0.06em]" style={{ color: r.color, borderColor: r.color }}>
                      {r.type.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-secondary">{r.target}</span>
                  </div>
                  <div className="mt-1 truncate text-[11.5px] text-dim">{r.desc}</div>
                </button>
              ))
            ) : (
              <div className="py-2.5 font-mono text-[11px] text-faint">— none</div>
            )}
          </div>

          <div className="mt-7 font-mono text-[11px] tracking-[0.12em] text-dim">BACKLINKS ↘</div>
          <div className="mt-3">
            {backlinks.length > 0 ? (
              backlinks.map((b) => (
                <button
                  key={b.slug}
                  onClick={() => navigate({ to: '/plan/$slug', params: { slug: b.slug } })}
                  className="v2row block w-full cursor-pointer border-t border-faintline py-2.5 text-left"
                >
                  <div className="text-[13px] text-secondary">{b.frontmatter?.title ?? b.slug}</div>
                  {b.frontmatter?.tldr && <div className="mt-0.5 truncate font-mono text-[11px] text-dim">{b.frontmatter.tldr}</div>}
                </button>
              ))
            ) : (
              <div className="py-2.5 font-mono text-[11px] text-faint">— none</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
