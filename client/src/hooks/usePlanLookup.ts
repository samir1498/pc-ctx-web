import { useProjectFolder } from './useContext'
import type { ContextItem } from '../types'

// Roadmap entries, loops and archive pages point at plans by frontmatter
// slug (not the file name); references use "plan:<slug>". This resolves
// either form against the live and archived plans.
export function usePlanLookup(project: string, enabled = true): (ref: string) => ContextItem | undefined {
  const plans = useProjectFolder(project, 'plans', true, enabled)
  const archived = useProjectFolder(project, 'plans-archived', true, enabled)
  const all: ContextItem[] = [...(plans.data ?? []), ...(archived.data ?? [])]
  return (raw: string) => {
    const ref = raw.replace(/^plan:/, '').trim()
    if (!ref) return undefined
    return all.find((p) => p.frontmatter?.slug === ref || p.slug === ref || p.slug.endsWith(`-${ref}`))
  }
}
