import { useFolder } from '../hooks/useContext'
import { PageHeader } from '../components/PageHeader'
import { MarkdownContent } from '../components/MarkdownContent'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { statusColor } from '../lib/ui'

export function HandoffsPage() {
  const { data: items, isLoading, error } = useFolder('handoffs')

  if (isLoading) return <div className="px-10 py-6"><LoadingSpinner /></div>
  if (error) return <div className="px-10 py-6 text-sm text-red">Error: {(error as Error).message}</div>

  const sorted = [...(items ?? [])].sort(
    (a, b) => Number(b.frontmatter?.created ?? 0) - Number(a.frontmatter?.created ?? 0),
  )

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="DOMAIN / HANDOFFS"
        title="Handoffs"
        subtitle="session-to-session state · open = unconsumed"
        isNew
      />

      <div className="px-10 pb-10 pt-2">
        {sorted.map((h) => {
          const fm = h.frontmatter ?? {}
          return (
            <div key={h.slug} className="mt-[18px] border border-border bg-panel px-[22px] py-5">
              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-dim">
                <span style={{ color: statusColor(fm.status) }}>[{fm.status ?? '—'}]</span>
                <span className="text-fainter">/</span>
                <span>SESSION {String(fm.created ?? '—')}</span>
                {fm.category && (
                  <>
                    <span className="text-fainter">/</span>
                    <span className="text-muted">{String(fm.category)}</span>
                  </>
                )}
              </div>
              <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.02em]">{fm.title ?? h.slug}</h2>
              {fm.tldr && <p className="mt-1.5 text-[13.5px] text-muted">{fm.tldr}</p>}
              {h.body && (
                <details className="mt-4 group">
                  <summary className="cursor-pointer list-none font-mono text-[10px] tracking-[0.12em] text-faint hover:text-secondary">
                    ▸ FULL HANDOFF
                  </summary>
                  <div className="mt-4 max-w-[760px] border-t border-faintline pt-4">
                    <MarkdownContent body={h.body} />
                  </div>
                </details>
              )}
            </div>
          )
        })}
        {sorted.length === 0 && <p className="py-16 text-center font-mono text-xs text-faint">no handoffs</p>}
      </div>
    </div>
  )
}
