import { useNavigate } from '@tanstack/react-router'
import { useItem } from '../hooks/useContext'
import { MarkdownContent } from '../components/MarkdownContent'
import { TaskList } from '../components/TaskList'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { ChevronLeft } from '../components/Icons'

interface PlanDetailPageProps {
  slug: string
}

export function PlanDetailPage({ slug }: PlanDetailPageProps) {
  const navigate = useNavigate()
  const { data: item, isLoading, error } = useItem('plans', slug)

  if (isLoading) return <LoadingSpinner />
  if (error) return <div className="text-red text-sm">Error: {(error as Error).message}</div>
  if (!item) return <div className="text-secondary text-sm">Not found.</div>

  const fm = item.frontmatter

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate({ to: '/' })}
        className="flex items-center gap-1 text-xs text-secondary hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft />
        Plans
      </button>

      <article>
        <header className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-2">{fm.title as string}</h1>
          {fm.tldr && (
            <p className="text-sm text-secondary leading-relaxed">{fm.tldr as string}</p>
          )}
          <div className="flex items-center gap-2 mt-4">
            {fm.status && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                fm.status === 'active' ? 'text-green bg-green-bg border-green/20' :
                fm.status === 'paused' ? 'text-amber bg-amber-bg border-amber/20' :
                fm.status === 'done' ? 'text-blue bg-blue-bg border-blue/20' :
                'text-secondary bg-elevated border-border'
              }`}>
                {fm.status as string}
              </span>
            )}
            {fm.category && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-elevated text-secondary border border-border">
                {fm.category as string}
              </span>
            )}
            {fm.priority !== undefined && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-elevated text-secondary border border-border">
                P{fm.priority as number}
              </span>
            )}
            {typeof fm.tasks === 'string' && (
              <span className="text-xs text-secondary">
                {fm.tasks as string} tasks
              </span>
            )}
          </div>
        </header>

        {Array.isArray(fm.tasks) && (
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Tasks</h2>
            <TaskList tasks={(fm.tasks as { id: string; title: string; status: string }[])} />
          </section>
        )}

        {item.body && (
          <section>
            <MarkdownContent body={item.body} />
          </section>
        )}
      </article>
    </div>
  )
}
