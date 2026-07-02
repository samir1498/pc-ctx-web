import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { statusColor } from '../lib/ui'

interface RoadmapEntry {
  ref?: string
  status?: string
  note?: string
}

export function RoadmapsPage() {
  const navigate = useNavigate()
  const { data: items, isLoading, error } = useFolder('roadmaps')

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="DOMAIN / ROADMAPS"
        title="Roadmaps"
        subtitle="initiatives by period · entries link to plans"
      />

      <div className="pad-x pb-10 pt-2">
        {(items ?? []).map((r) => {
          const fm = r.frontmatter ?? {}
          const entries = (Array.isArray(fm.entries) ? fm.entries : []) as RoadmapEntry[]
          return (
            <div key={r.slug} className="border-b border-border py-[26px]">
              <div className="flex flex-wrap items-baseline gap-3.5">
                {fm.period && (
                  <span className="border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-foreground">
                    {String(fm.period)}
                  </span>
                )}
                <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{fm.title ?? r.slug}</h2>
                {fm.status && (
                  <span className="font-mono text-[11px]" style={{ color: statusColor(fm.status) }}>
                    [{fm.status}]
                  </span>
                )}
              </div>
              {fm.tldr && <p className="mt-2 text-[13.5px] text-muted">{fm.tldr}</p>}

              <div className="mt-4 flex flex-col gap-px">
                {entries.map((e, i) => {
                  const ref = e.ref ?? ''
                  const isPlan = ref.length > 0 && !ref.includes(':')
                  return (
                    <button
                      key={ref + i}
                      disabled={!isPlan}
                      onClick={() => isPlan && navigate({ to: '/plan/$slug', params: { slug: ref } })}
                      className={`v2row flex items-center gap-3 border-l-2 bg-input px-3 py-2.5 text-left ${isPlan ? 'cursor-pointer' : ''}`}
                      style={{ borderLeftColor: statusColor(e.status) }}
                    >
                      <span className="w-24 flex-shrink-0 font-mono text-[11px]" style={{ color: statusColor(e.status) }}>
                        [{e.status ?? '—'}]
                      </span>
                      <span className="flex-1 text-[13.5px] text-secondary">{e.note ?? ref}</span>
                      <span className="hidden flex-shrink-0 font-mono text-[11px] text-dim sm:inline">
                        {isPlan ? `plan:${ref} →` : ref}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {(items ?? []).length === 0 && (
          <p className="py-16 text-center font-mono text-xs text-faint">no roadmaps</p>
        )}
      </div>
    </div>
  )
}
