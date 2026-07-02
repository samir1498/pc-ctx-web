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
  x: number
  y: number
  w: number
  cx: number
  cy: number
}

// Two wide columns: plans on the left, everything they reference on the right.
const PLAN_COL = { x: 40, w: 380 }
const REF_COL = { x: 480, w: 380 }
const VIEW_W = 900
const NODE_H = 34
const ROW_STEP = 46
const TOP = 36
// JetBrains Mono at 11px is ~6.6px/char; keep labels inside the box (14px left
// inset + a little right breathing room) with an ellipsis instead of overflowing.
const CHAR_W = 6.6
const LABEL_PAD = 22

function fit(label: string, w: number): string {
  const max = Math.max(6, Math.floor((w - LABEL_PAD) / CHAR_W))
  return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

function refsOf(p: ContextItem): string[] {
  return Array.isArray(p.frontmatter?.references) ? (p.frontmatter.references as string[]) : []
}

export function GraphPage() {
  const navigate = useNavigate()
  const { data: plans, isLoading, error } = useFolder('plans', true)

  const { nodes, edges, height } = useMemo(() => {
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

    const place = (id: string, slug: string, rawLabel: string, type: keyof typeof TYPE_COLOR, isPlan: boolean) => {
      const existing = nodeMap.get(id)
      if (existing) return existing
      const col = isPlan ? PLAN_COL : REF_COL
      const row = isPlan ? planRow++ : refRow++
      const y = TOP + row * ROW_STEP
      const node: GNode = {
        id,
        slug,
        label: fit(rawLabel, col.w),
        type,
        isPlan,
        x: col.x,
        y,
        w: col.w,
        cx: col.x + col.w / 2,
        cy: y + NODE_H / 2,
      }
      nodeMap.set(id, node)
      return node
    }

    // plans first (left column), so referenced plans keep a stable position
    for (const p of connected) {
      place(`plan:${p.slug}`, p.slug, (p.frontmatter?.title as string) ?? p.slug, 'plan', true)
    }

    const rawEdges: { from: string; to: string; kind: 'solid' | 'dash' }[] = []
    for (const p of connected) {
      for (const r of refsOf(p)) {
        const idx = r.indexOf(':')
        const type = (idx === -1 ? 'ref' : r.slice(0, idx)) as keyof typeof TYPE_COLOR
        const target = idx === -1 ? r : r.slice(idx + 1)
        const isPlanTarget = type === 'plan'
        const toId = isPlanTarget ? `plan:${target}` : `${type}:${target}`
        if (!nodeMap.has(toId)) {
          const rawLabel = isPlanTarget ? target : target.replace(/^https?:\/\//, '')
          place(toId, target, rawLabel, TYPE_COLOR[type] ? type : 'ref', isPlanTarget)
        }
        rawEdges.push({ from: `plan:${p.slug}`, to: toId, kind: type === 'roadmap' ? 'dash' : 'solid' })
      }
    }

    const edges = rawEdges
      .map((e) => {
        const a = nodeMap.get(e.from)
        const b = nodeMap.get(e.to)
        if (!a || !b) return null
        const toRight = b.cx >= a.cx
        const x1 = toRight ? a.x + a.w : a.x
        const x2 = toRight ? b.x : b.x + b.w
        return { x1, y1: a.cy, x2, y2: b.cy, kind: e.kind }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    const maxRow = Math.max(planRow, refRow, 1)
    return { nodes: [...nodeMap.values()], edges, height: Math.max(300, TOP + maxRow * ROW_STEP + 20) }
  }, [plans])

  if (isLoading) return <div className="pad-x py-6"><LoadingSpinner /></div>
  if (error) return <div className="pad-x py-6 text-sm text-red">Error: {(error as Error).message}</div>

  return (
    <div className="animate-fade-in">
      <PageHeader
        kicker="VIEW / DEPENDENCY GRAPH"
        title="Graph"
        subtitle={
          <>resolves <span className="text-secondary">plan:</span> · <span className="text-secondary">research:</span> · <span className="text-secondary">url:</span> refs + backlinks · maps the <span className="text-secondary">ctx graph</span> command</>
        }
        isNew
      />

      <div className="pad-x py-7">
        {nodes.length === 0 ? (
          <p className="border border-border bg-[#0c0c0f] py-16 text-center font-mono text-xs text-faint">
            no references between plans yet
          </p>
        ) : (
          <div className="border border-border bg-[#0c0c0f]">
            <svg viewBox={`0 0 ${VIEW_W} ${height}`} className="block w-full" preserveAspectRatio="xMidYMid meet">
              <defs>
                <pattern id="v2grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M30 0H0V30" fill="none" stroke="#141418" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={VIEW_W} height={height} fill="url(#v2grid)" />
              {edges.map((e, i) => (
                <line
                  key={i}
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke="#2a2a44"
                  strokeWidth="1.5"
                  strokeDasharray={e.kind === 'dash' ? '4 4' : undefined}
                />
              ))}
              {nodes.map((n) => {
                const color = TYPE_COLOR[n.type] ?? '#3a3a40'
                return (
                  <g
                    key={n.id}
                    style={{ cursor: n.isPlan ? 'pointer' : 'default' }}
                    onClick={() => n.isPlan && navigate({ to: '/plan/$slug', params: { slug: n.slug } })}
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

        <div className="mt-[18px] flex flex-wrap gap-6 font-mono text-[11px] text-muted">
          <span className="flex items-center gap-[7px]"><span className="inline-block h-2.5 w-2.5 border-[1.5px] border-indigo" />plan</span>
          <span className="flex items-center gap-[7px]"><span className="inline-block h-2.5 w-2.5 border-[1.5px] border-amber" />roadmap</span>
          <span className="flex items-center gap-[7px]"><span className="inline-block h-2.5 w-2.5 border-[1.5px] border-green" />research</span>
          <span className="flex items-center gap-[7px]"><span className="inline-block w-3.5 border-t-[1.5px] border-[#3a3a40]" />reference</span>
          <span className="flex items-center gap-[7px]"><span className="inline-block w-3.5 border-t-[1.5px] border-dashed border-[#3a3a40]" />roadmap link</span>
        </div>
      </div>
    </div>
  )
}
