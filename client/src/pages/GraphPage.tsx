import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { ContextItem } from '../types'

const TYPE_COLOR: Record<string, string> = {
  plan: '#6366f1',
  roadmap: '#f59e0b',
  research: '#22c55e',
  url: '#3a3a40',
  ref: '#3a3a40',
}

interface GNode {
  id: string
  slug: string
  label: string
  type: keyof typeof TYPE_COLOR
  isPlan: boolean
  href?: string
  x: number
  y: number
  w: number
  cx: number
  cy: number
}

// Left column = plans. Right column = everything they reference, grouped. The
// left margin (0..PLAN_COL.x) is reserved for plan→plan dependency arcs.
const PLAN_COL = { x: 70, w: 350 }
const REF_COL = { x: 496, w: 350 }
const VIEW_W = 900
const NODE_H = 34
const ROW_STEP = 46
const TOP = 36
const LEFT_BOW = 14
// JetBrains Mono at 11px is ~6.6px/char; keep labels inside the box with an
// ellipsis instead of overflowing.
const CHAR_W = 6.6
const LABEL_PAD = 22

function fit(label: string, w: number): string {
  const max = Math.max(6, Math.floor((w - LABEL_PAD) / CHAR_W))
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

function refsOf(p: ContextItem): string[] {
  return Array.isArray(p.frontmatter?.references) ? (p.frontmatter.references as string[]) : []
}

interface Target {
  id: string
  slug: string
  label: string
  type: keyof typeof TYPE_COLOR
  isPlan: boolean
  href?: string
}

// Resolve a `scheme:value` reference to a graph node. URLs collapse to one node
// per GitHub repo (owner/repo) or per host, so dozens of PR/commit links don't
// each spawn their own box.
function resolveTarget(ref: string): Target {
  const idx = ref.indexOf(':')
  const scheme = idx === -1 ? 'ref' : ref.slice(0, idx)
  const rest = idx === -1 ? ref : ref.slice(idx + 1)

  if (scheme === 'plan') {
    return { id: `plan:${rest}`, slug: rest, label: rest, type: 'plan', isPlan: true }
  }
  if (scheme === 'research') {
    const leaf = rest.split('/').pop() ?? rest
    return { id: `research:${rest}`, slug: rest, label: leaf, type: 'research', isPlan: false }
  }
  if (scheme === 'url') {
    try {
      const u = new URL(rest)
      const host = u.hostname.replace(/^www\./, '')
      const parts = u.pathname.split('/').filter(Boolean)
      if (host.endsWith('github.com') && parts.length >= 2) {
        const key = `${parts[0]}/${parts[1]}`
        return {
          id: `repo:${key}`,
          slug: key,
          label: parts[1] as string,
          type: 'url',
          isPlan: false,
          href: `https://github.com/${key}`,
        }
      }
      return { id: `host:${host}`, slug: host, label: host, type: 'url', isPlan: false, href: u.origin }
    } catch {
      return { id: `url:${rest}`, slug: rest, label: rest.slice(0, 46), type: 'url', isPlan: false }
    }
  }
  const type: keyof typeof TYPE_COLOR = TYPE_COLOR[scheme] ? (scheme as keyof typeof TYPE_COLOR) : 'ref'
  return { id: `${scheme}:${rest}`, slug: rest, label: rest, type, isPlan: false }
}

export function GraphPage() {
  const navigate = useNavigate()
  const { data: plans, isLoading, error } = useFolder('plans', true)

  const { nodes, external, internal, height } = useMemo(() => {
    const list = plans ?? []

    // Only graph plans that participate: they reference something, or another
    // plan references them. Unconnected plans just clutter the picture.
    const referencedPlans = new Set<string>()
    for (const p of list) {
      for (const r of refsOf(p)) {
        if (r.startsWith('plan:')) referencedPlans.add(r.slice(5))
      }
    }
    const connected = list.filter((p) => refsOf(p).length > 0 || referencedPlans.has(p.slug))

    const nodeMap = new Map<string, GNode>()
    let planRow = 0
    let refRow = 0

    const place = (t: Target): GNode => {
      const existing = nodeMap.get(t.id)
      if (existing) return existing
      const col = t.isPlan ? PLAN_COL : REF_COL
      const row = t.isPlan ? planRow++ : refRow++
      const y = TOP + row * ROW_STEP
      const node: GNode = {
        id: t.id,
        slug: t.slug,
        label: fit(t.label, col.w),
        type: t.type,
        isPlan: t.isPlan,
        href: t.href,
        x: col.x,
        y,
        w: col.w,
        cx: col.x + col.w / 2,
        cy: y + NODE_H / 2,
      }
      nodeMap.set(t.id, node)
      return node
    }

    // plans first (left column), so referenced plans keep a stable position
    for (const p of connected) {
      place({
        id: `plan:${p.slug}`,
        slug: p.slug,
        label: (p.frontmatter?.title as string) ?? p.slug,
        type: 'plan',
        isPlan: true,
      })
    }

    const seen = new Set<string>()
    const rawEdges: { from: string; to: string; kind: 'solid' | 'dash'; internal: boolean }[] = []
    for (const p of connected) {
      const fromId = `plan:${p.slug}`
      for (const r of refsOf(p)) {
        const t = resolveTarget(r)
        if (t.id === fromId) continue // self-reference
        place(t)
        const key = `${fromId}|${t.id}`
        if (seen.has(key)) continue
        seen.add(key)
        rawEdges.push({ from: fromId, to: t.id, kind: t.type === 'roadmap' ? 'dash' : 'solid', internal: t.isPlan })
      }
    }

    // plan→plan dependencies: both endpoints sit in the left column, so route
    // them as an arc that bows into the left margin instead of a line dragged
    // backwards across the whole canvas.
    const internal: { d: string; kind: 'solid' | 'dash' }[] = []
    // plan→reference: a straight line from the plan's right edge to the ref's left edge.
    const external: { x1: number; y1: number; x2: number; y2: number; kind: 'solid' | 'dash' }[] = []
    for (const e of rawEdges) {
      const a = nodeMap.get(e.from)
      const b = nodeMap.get(e.to)
      if (!a || !b) continue
      if (e.internal) {
        const midY = (a.cy + b.cy) / 2
        internal.push({ d: `M ${a.x} ${a.cy} Q ${LEFT_BOW} ${midY} ${b.x} ${b.cy}`, kind: e.kind })
      } else {
        external.push({ x1: a.x + a.w, y1: a.cy, x2: b.x, y2: b.cy, kind: e.kind })
      }
    }

    const maxRow = Math.max(planRow, refRow, 1)
    return { nodes: [...nodeMap.values()], external, internal, height: Math.max(300, TOP + maxRow * ROW_STEP + 20) }
  }, [plans])

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="VIEW / DEPENDENCY GRAPH"
        title="Graph"
        subtitle={
          <>plan dependencies arc on the left · external <span className="text-secondary">research:</span> · <span className="text-secondary">url:</span> refs group by repo/host on the right</>
        }
        isNew
      />

      <div className="pad-x py-7">
        {nodes.length === 0 ? (
          <p className="border border-border bg-panel py-16 text-center font-mono text-xs text-faint">
            no references between plans yet
          </p>
        ) : (
          <div className="border border-border bg-panel">
            <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="block w-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="v2grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M30 0H0V30" fill="none" stroke="#141418" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={VIEW_W} height={height} fill="url(#v2grid)" />
              {external.map((e, i) => (
                <line
                  key={`e${i}`}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="#2a2a44"
                  strokeWidth="1.5"
                  strokeDasharray={e.kind === 'dash' ? '4 4' : undefined}
                />
              ))}
              {internal.map((e, i) => (
                <path
                  key={`i${i}`}
                  d={e.d}
                  fill="none"
                  stroke="#6366f1"
                  strokeOpacity="0.5"
                  strokeWidth="1.5"
                  strokeDasharray={e.kind === 'dash' ? '4 4' : undefined}
                />
              ))}
              {nodes.map((n) => {
                const color = TYPE_COLOR[n.type] ?? '#3a3a40'
                const clickable = n.isPlan || Boolean(n.href)
                return (
                  <g
                    key={n.id}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (n.isPlan) navigate({ to: '/plan/$slug', params: { slug: n.slug } })
                      else if (n.href) window.open(n.href, '_blank', 'noopener')
                    }}
                  >
                    <rect x={n.x} y={n.y} width={n.w} height={NODE_H} fill="#111116" stroke={color} strokeWidth="1.5" />
                    <rect x={n.x} y={n.y} width="4" height={NODE_H} fill={color} />
                    <text x={n.x + 14} y={n.y + 15} fill="#dcdce0" fontFamily="JetBrains Mono, monospace" fontSize="11">
                      {n.label}
                    </text>
                    <text x={n.x + 14} y={n.y + 27} fill="#5b5b62" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1">
                      {n.type.toUpperCase()}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-6 font-mono text-2xs text-muted">
          <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 border-[1.5px] border-indigo" />plan</span>
          <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 border-[1.5px] border-green" />research</span>
          <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 border-[1.5px] border-outline" />repo / host</span>
          <span className="flex items-center gap-2"><span className="inline-block w-3.5 border-t-[1.5px] border-indigo" />plan dependency</span>
          <span className="flex items-center gap-2"><span className="inline-block w-3.5 border-t-[1.5px] border-outline" />reference</span>
        </div>
      </div>
    </div>
  )
}
