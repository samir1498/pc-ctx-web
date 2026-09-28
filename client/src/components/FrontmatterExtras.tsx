import { Link } from '@tanstack/react-router'
import { usePlanLookup } from '../hooks/usePlanLookup'
import { planTitle } from '../lib/hub'
import { stripCodes } from '../lib/plain'
import type { ContextItem } from '../types'

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '') : [])

/** The plan's `acceptance` list: what has to be true for it to count as done. */
export function AcceptanceList({ value, plain }: { value: unknown; plain: boolean }) {
  const items = strings(value)
  if (items.length === 0) return null
  return (
    <section>
      <h2 className="section-title">Done means</h2>
      <ul className="check-list">
        {items.map((raw, i) => {
          const text = plain ? stripCodes(raw).trim() || raw : raw
          return <li key={`${i}-${raw.slice(0, 24)}`}>{text}</li>
        })}
      </ul>
    </section>
  )
}

/** A link to a plan named by slug or "plan:<slug>", or the bare ref when it is not in the store. */
export function PlanRef({ project, value, lookup }: { project: string; value: string; lookup: (ref: string) => ContextItem | undefined }) {
  const plan = lookup(value)
  if (!plan) return <span className="font-mono text-xs">{value}</span>
  return (
    <Link to="/p/$project/plan/$slug" params={{ project, slug: plan.slug }} className="no-underline hover:underline">
      {planTitle(plan)}
    </Link>
  )
}

// `references` mix "plan:<slug>", "research:<path>" and repo paths. Plans
// link; the rest stay as text. Hidden from a plain reader: paths mean nothing
// to them and stripCodes would leave blanks.
export function ReferenceList({ project, value }: { project: string; value: unknown }) {
  const items = strings(value)
  const lookup = usePlanLookup(project, items.some((r) => r.startsWith('plan:')))
  if (items.length === 0) return null
  return (
    <section>
      <h2 className="section-title">References</h2>
      <ul className="ref-list">
        {items.map((ref, i) => (
          <li key={`${i}-${ref}`}>{ref.startsWith('plan:') ? <PlanRef project={project} value={ref} lookup={lookup} /> : <span className="font-mono text-xs break-all">{ref}</span>}</li>
        ))}
      </ul>
    </section>
  )
}
