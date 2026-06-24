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

  if (isLoading) return <div className="px-10 py-6"><LoadingSpinner /></div>
  if (error) return <div className="px-10 py-6 text-sm text-red">Error: {(error as Error).message}</div>
  if (!item) return <div className="px-10 py-6 text-sm text-muted">Not found.</div>

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
<<<<<<< HEAD
      <div className="px-10 pt-6">
        <button
          onClick={() => navigate({ to: '/plans' })}
          className="cursor-pointer font-mono text-[11px] tracking-[0.04em] text-muted hover:text-foreground"
        >
          ← PLANS
        </button>
      </div>

      <div className="border-b border-border px-10 pb-6 pt-5">
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

      <div className="grid grid-cols-[1fr_1px_320px] px-10">
        <div className="py-[26px] pr-9">
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

        <div className="bg-border" />

        <div className="py-[26px] pl-8">
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
=======
      <button
        onClick={() => navigate({ to: '/plans' })}
        className="flex items-center gap-1 text-xs text-secondary hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft />
        Plans
      </button>

      <article>
        <header className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">{fm.title}</h1>
          {fm.tldr && (
            <p className="text-sm text-secondary leading-relaxed">{fm.tldr}</p>
          )}
          <div className="flex items-center gap-2 mt-4">
            {fm.status && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                fm.status === 'active' ? 'text-green bg-green-bg border-green/20' :
                fm.status === 'paused' ? 'text-amber bg-amber-bg border-amber/20' :
                fm.status === 'done' ? 'text-blue bg-blue-bg border-blue/20' :
                'text-secondary bg-elevated border-border'
              }`}>
                {fm.status}
              </span>
            )}
            {fm.category && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-elevated text-secondary border border-border">
                {fm.category}
              </span>
            )}
            {fm.priority !== undefined && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-elevated text-secondary border border-border">
                P{fm.priority}
              </span>
            )}
            {typeof fm.tasks === 'string' && (
              <span className="text-xs text-secondary">
                {fm.tasks} tasks
              </span>
>>>>>>> origin/main
            )}
          </div>

<<<<<<< HEAD
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
=======
        {Array.isArray(fm.tasks) && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Tasks</h2>
            <TaskList tasks={fm.tasks} />
          </section>
        )}

        {item.body && (
          <section>
            <MarkdownContent body={item.body} />
          </section>
        )}
      </article>
>>>>>>> origin/main
    </div>
  )
}
