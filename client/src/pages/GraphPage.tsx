import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useFolder } from '../hooks/useContext'
import { PageHeader } from '../components/PageHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'

const TYPE_COLOR: Record<string, string> = {
  plan: '#6366f1',
  roadmap: '#f59e0b',
  research: '#22c55e',
  url: '#3a3a40',
  ref: '#3a3a40',
}

const COLUMN: Record<string, number> = { roadmap: 0, plan: 1, research: 2, url: 2, ref: 2 }

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

const COL_X = [40, 360, 690]
const COL_W = [150, 170, 180]
const NODE_H = 34
const ROW_STEP = 46
const TOP = 36

export function GraphPage() {
  const navigate = useNavigate()
  const { data: plans, isLoading, error } = useFolder('plans')

  const { nodes, edges, height } = useMemo(() => {
    const nodeMap = new Map<string, GNode>()
    const cols: Record<number, number> = { 0: 0, 1: 0, 2: 0 }

    const place = (id: string, slug: string, label: string, type: keyof typeof TYPE_COLOR, isPlan: boolean) => {
      if (nodeMap.has(id)) return nodeMap.get(id)!
      const c = COLUMN[type] ?? 2
      const row = cols[c]++
      const x = COL_X[c]
      const w = COL_W[c]
      const y = TOP + row * ROW_STEP
      const node: GNode = { id, slug, label, type, isPlan, x, y, w, cx: x + w / 2, cy: y + NODE_H / 2 }
      nodeMap.set(id, node)
      return node
    }

    // plans first (center column)
    for (const p of plans ?? []) {
      place(`plan:${p.slug}`, p.slug, p.frontmatter?.title?.slice(0, 26) ?? p.slug, 'plan', true)
    }
    // referenced targets
    const rawEdges: { from: string; to: string; kind: 'solid' | 'dash' }[] = []
    for (const p of plans ?? []) {
      const refs = Array.isArray(p.frontmatter?.references) ? p.frontmatter.references : []
      for (const r of refs) {
        const idx = r.indexOf(':')
        const type = (idx === -1 ? 'ref' : r.slice(0, idx)) as keyof typeof TYPE_COLOR
        const target = idx === -1 ? r : r.slice(idx + 1)
        const toId = type === 'plan' ? `plan:${target}` : `${type}:${target}`
        if (!nodeMap.has(toId)) {
          place(toId, target, target.replace(/^https?:\/\//, '').slice(0, 26), TYPE_COLOR[type] ? type : 'ref', type === 'plan')
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

    const maxRow = Math.max(cols[0], cols[1], cols[2], 1)
    return { nodes: [...nodeMap.values()], edges, height: Math.max(460, TOP + maxRow * ROW_STEP + 20) }
  }, [plans])

  if (isLoading) return <div className="px-10 py-6"><LoadingSpinner /></div>
  if (error) return <div className="px-10 py-6 text-sm text-red">Error: {(error as Error).message}</div>

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

      <div className="px-10 py-7">
        <div className="border border-border bg-[#0c0c0f]">
          <svg viewBox={`0 0 900 ${height}`} className="block w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="v2grid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M30 0H0V30" fill="none" stroke="#141418" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="900" height={height} fill="url(#v2grid)" />
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
