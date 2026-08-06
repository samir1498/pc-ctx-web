import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { statusColor, parseCreated } from '../lib/ui'

interface RoadmapEntry {
  ref?: string
  status?: string
  note?: string
}

const ARCHIVED = new Set(['archived', 'done', 'cancelled', 'superseded'])
const OPEN_ORDER = ['active', 'next', 'in-progress', 'planned', 'paused', 'blocked']

/** Live roadmaps first, archived last. */
const group = (s?: string) => (s && ARCHIVED.has(s) ? 1 : 0)

/** Slugs are the only per-entry title we have — make them readable. */
const titleOf = (ref: string) => {
  if (!ref) return 'untitled'
  const words = ref.replace(/^\d+-/, '').split('-')
  const s = words.join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Notes are authored as "P2 — the actual note"; lift the phase into a group header. */
const PHASE_RE = /^(P\d)\s*[—-]\s*/
const phaseOf = (note?: string) => PHASE_RE.exec(note ?? '')?.[1] ?? null
const stripPhase = (note?: string) => (note ?? '').replace(PHASE_RE, '')

const createdKey = (fm: Record<string, unknown>, slug: string) => {
  const d = parseCreated(fm.created as string | number | undefined)
  if (d) return d.getTime()
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(slug)
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}`).getTime() : 0
}

const fmtDate = (fm: Record<string, unknown>, slug: string) => {
  const t = createdKey(fm, slug)
  if (!t) return null
  return new Date(t).toLocaleDateString('en-CA') // YYYY-MM-DD, locale-stable
}

function AnchorLink({ id }: Readonly<{ id: string }>) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      aria-label={`Copy link to ${id}`}
      title="Copy link to this section"
      className="font-mono text-2xs text-dim opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
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

/** Proportional status bar — the shape of a roadmap at a glance. */
function StatusBar({ counts, total }: Readonly<{ counts: Map<string, number>; total: number }>) {
  if (!total) return null
  return (
    <div className="flex h-1 w-28 overflow-hidden rounded-sm bg-input">
      {[...counts.entries()].map(([status, n]) => (
        <div key={status} style={{ width: `${(n / total) * 100}%`, backgroundColor: statusColor(status) }} />
      ))}
    </div>
  )
}

export function RoadmapsPage() {
  const navigate = useNavigate()
  const { data: items, isLoading, error } = useFolder('roadmaps', true)
  const [showArchived, setShowArchived] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })

  // A deep link must open the roadmap it points at, then scroll to it. Content
  // loads async, so the browser's own fragment jump fires too early.
  useEffect(() => {
    if (isLoading || !window.location.hash) return
    const id = decodeURIComponent(window.location.hash.slice(1))
    setOpen((prev) => new Set(prev).add(id.split('--')[0]))
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 60)
    return () => clearTimeout(t)
  }, [isLoading, items])

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  const all = items ?? []
  const archivedCount = all.filter((r) => ARCHIVED.has(String(r.frontmatter?.status ?? ''))).length
  const visible = all
    .filter((r) => showArchived || !ARCHIVED.has(String(r.frontmatter?.status ?? '')))
    .sort(
      (a, b) =>
        group(a.frontmatter?.status as string) - group(b.frontmatter?.status as string) ||
        createdKey(b.frontmatter ?? {}, b.slug) - createdKey(a.frontmatter ?? {}, a.slug),
    )

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="DOMAIN / ROADMAPS"
        title="Roadmaps"
        subtitle="initiatives by period · click one to expand · entries link to plans"
      />

      <div className="pad-x pb-10 pt-2">
        <div className="mb-3 flex items-center gap-4">
          <button
            className="font-mono text-2xs text-dim hover:text-foreground"
            onClick={() => setOpen(open.size ? new Set() : new Set(visible.map((r) => r.slug)))}
          >
            {open.size ? 'collapse all' : 'expand all'}
          </button>
          {archivedCount > 0 && (
            <button
              className="font-mono text-2xs text-dim hover:text-foreground"
              onClick={() => setShowArchived((v) => !v)}
            >
              {showArchived ? `hide ${archivedCount} archived` : `show ${archivedCount} archived`}
            </button>
          )}
        </div>

        {visible.map((r) => {
          const fm = r.frontmatter ?? {}
          const entries = (Array.isArray(fm.entries) ? fm.entries : []) as RoadmapEntry[]
          const isOpen = open.has(r.slug)
          const date = fmtDate(fm, r.slug)

          const counts = new Map<string, number>()
          for (const e of entries) counts.set(e.status ?? 'planned', (counts.get(e.status ?? 'planned') ?? 0) + 1)
          const openCount = OPEN_ORDER.reduce((n, s) => n + (counts.get(s) ?? 0), 0)

          return (
            <div key={r.slug} id={r.slug} className="scroll-mt-20 border-b border-border">
              <div className="flex items-center gap-3 py-3.5">
                <button
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => toggle(r.slug)}
                  aria-expanded={isOpen}
                >
                  <span className="w-3 flex-shrink-0 font-mono text-2xs text-dim">{isOpen ? '▾' : '▸'}</span>
                  <span className="truncate text-base font-semibold tracking-[-0.01em]">{fm.title ?? r.slug}</span>
                  {fm.status && (
                    <span className="flex-shrink-0 font-mono text-2xs" style={{ color: statusColor(fm.status) }}>
                      [{fm.status}]
                    </span>
                  )}
                  <span className="ml-auto hidden flex-shrink-0 items-center gap-3 sm:flex">
                    <StatusBar counts={counts} total={entries.length} />
                    <span className="w-28 text-right font-mono text-2xs text-dim">
                      {openCount}/{entries.length} open
                    </span>
                    {date && <span className="w-24 text-right font-mono text-2xs text-faint">{date}</span>}
                  </span>
                </button>
                <AnchorLink id={r.slug} />
              </div>

              {isOpen && (
                <div className="pb-6 pl-6">
                  {fm.tldr && <p className="mb-4 max-w-3xl text-sm text-muted">{fm.tldr}</p>}
                  <div className="flex flex-col">
                    {entries.map((e, i) => {
                      const ref = e.ref ?? ''
                      const isPlan = ref.length > 0 && !ref.includes(':')
                      const entryId = `${r.slug}--${ref || i}`
                      const phase = phaseOf(e.note)
                      const newPhase = phase && phase !== phaseOf(entries[i - 1]?.note)
                      return (
                        <div key={ref + i}>
                          {newPhase && (
                            <div className="mb-1 mt-4 font-mono text-2xs uppercase tracking-wider text-faint first:mt-0">
                              {phase}
                            </div>
                          )}
                          <div id={entryId} className="group flex scroll-mt-20 items-start gap-2">
                            <button
                              disabled={!isPlan}
                              onClick={() => isPlan && navigate({ to: '/plan/$slug', params: { slug: ref } })}
                              className={`v2row mb-px flex flex-1 items-start gap-3 border-l-2 bg-input px-3 py-2 text-left ${isPlan ? 'cursor-pointer' : ''}`}
                              style={{ borderLeftColor: statusColor(e.status) }}
                            >
                              <span
                                className="w-20 flex-shrink-0 pt-0.5 font-mono text-2xs"
                                style={{ color: statusColor(e.status) }}
                              >
                                [{e.status ?? '—'}]
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-foreground">{titleOf(ref)}</span>
                                {e.note && (
                                  <span className="mt-0.5 line-clamp-1 block text-2xs text-dim">
                                    {stripPhase(e.note)}
                                  </span>
                                )}
                              </span>
                            </button>
                            <AnchorLink id={entryId} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
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
