import type { ContextItem } from '../types'

interface ItemCardProps {
  item: ContextItem
  onClick: () => void
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  const fm = item.frontmatter
  const title =
    (fm?.title as string) ||
    (fm?.tldr as string) ||
    item.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const status = fm?.status as string | undefined
  const priority = fm?.priority as number | undefined

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-lg border border-border bg-surface hover:bg-elevated hover:border-accent/30 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate">{title}</h3>
          {fm?.tldr && (
            <p className="text-xs text-secondary mt-1 line-clamp-2 leading-relaxed">{fm.tldr as string}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {priority !== undefined && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-elevated text-secondary border border-border leading-none">
              P{priority}
            </span>
          )}
          {status && (
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium border leading-none ${
              status === 'active' ? 'bg-green-bg text-green border-green/20' :
              status === 'paused' ? 'bg-amber-bg text-amber border-amber/20' :
              status === 'done' ? 'bg-blue-bg text-blue border-blue/20' :
              status === 'cancelled' ? 'bg-red-bg text-red border-red/20' :
              'bg-elevated text-secondary border-border'
            }`}>
              {status}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
