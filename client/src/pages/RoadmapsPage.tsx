import { useEffect, useState } from 'react'
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

const ARCHIVED = new Set(['archived', 'done', 'cancelled', 'superseded'])

// Live roadmaps first, archived last; newest first within each group.
const rank = (s?: string) => (s && ARCHIVED.has(s) ? 1 : 0)

// `created` is a YYYYMMDD number in frontmatter; fall back to the date prefix
// on the filename/slug so an entry missing it still sorts sanely.
const createdAt = (fm: Record<string, unknown>, slug: string) => {
  const c = Number(fm.created)
  if (Number.isFinite(c) && c > 0) return c
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(slug)
  return m ? Number(`${m[1]}${m[2]}${m[3]}`) : 0
}

function AnchorLink({ id }: Readonly<{ id: string }>) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      aria-label={`Copy link to ${id}`}
      title="Copy link to this section"
      className="font-mono text-2xs text-dim transition-opacity hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation()
        const url = `${window.location.origin}${window.location.pathname}#${id}`
        void navigator.clipboard.writeText(url)
        window.history.replaceState(null, '', `#${id}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? 'copied' : '#'}
    </button>
  )
}

export function RoadmapsPage() {
  const navigate = useNavigate()
  const { data: items, isLoading, error } = useFolder('roadmaps', true)
  const [showArchived, setShowArchived] = useState(false)

  // Jump to the hash once the list has rendered — content loads async, so the
  // browser's own scroll-to-fragment fires too early and lands nowhere.
  useEffect(() => {
    if (isLoading || !window.location.hash) return
    const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isLoading, items, showArchived])

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  const all = items ?? []
  const archivedCount = all.filter((r) => ARCHIVED.has(String(r.frontmatter?.status ?? ''))).length
  const visible = all
    .filter((r) => showArchived || !ARCHIVED.has(String(r.frontmatter?.status ?? '')))
    .sort((a, b) => {
      const byGroup = rank(a.frontmatter?.status as string) - rank(b.frontmatter?.status as string)
      if (byGroup !== 0) return byGroup
      return createdAt(b.frontmatter ?? {}, b.slug) - createdAt(a.frontmatter ?? {}, a.slug)
    })

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="DOMAIN / ROADMAPS"
        title="Roadmaps"
        subtitle="initiatives by period · entries link to plans"
      />

      <div className="pad-x pb-10 pt-2">
        {archivedCount > 0 && (
          <button
            className="mb-2 font-mono text-2xs text-dim hover:text-foreground"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? `hide ${archivedCount} archived` : `show ${archivedCount} archived`}
          </button>
        )}

        {visible.map((r) => {
          const fm = r.frontmatter ?? {}
          const entries = (Array.isArray(fm.entries) ? fm.entries : []) as RoadmapEntry[]
          return (
            <div key={r.slug} id={r.slug} className="scroll-mt-20 border-b border-border py-7">
              <div className="flex flex-wrap items-baseline gap-3.5">
                {fm.period && (
                  <span className="border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-foreground">
                    {String(fm.period)}
                  </span>
                )}
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">{fm.title ?? r.slug}</h2>
                {fm.status && (
                  <span className="font-mono text-2xs" style={{ color: statusColor(fm.status) }}>
                    [{fm.status}]
                  </span>
                )}
                <AnchorLink id={r.slug} />
              </div>
              {fm.tldr && <p className="mt-2 text-sm text-muted">{fm.tldr}</p>}

              <div className="mt-4 flex flex-col gap-px">
                {entries.map((e, i) => {
                  const ref = e.ref ?? ''
                  const isPlan = ref.length > 0 && !ref.includes(':')
                  const entryId = `${r.slug}--${ref || i}`
                  return (
                    <div key={ref + i} id={entryId} className="flex scroll-mt-20 items-center gap-2">
                      <button
                        disabled={!isPlan}
                        onClick={() => isPlan && navigate({ to: '/plan/$slug', params: { slug: ref } })}
                        className={`v2row flex flex-1 items-center gap-3 border-l-2 bg-input px-3 py-2.5 text-left ${isPlan ? 'cursor-pointer' : ''}`}
                        style={{ borderLeftColor: statusColor(e.status) }}
                      >
                        <span className="w-24 flex-shrink-0 font-mono text-2xs" style={{ color: statusColor(e.status) }}>
                          [{e.status ?? '—'}]
                        </span>
                        <span className="flex-1 text-sm text-secondary">{e.note ?? ref}</span>
                        <span className="hidden flex-shrink-0 font-mono text-2xs text-dim sm:inline">
                          {isPlan ? `plan:${ref} →` : ref}
                        </span>
                      </button>
                      <AnchorLink id={entryId} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {visible.length === 0 && (
          <p className="py-16 text-center font-mono text-xs text-faint">no roadmaps</p>
        )}
      </div>
    </div>
  )
}
