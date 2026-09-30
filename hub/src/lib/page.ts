import type { AstroGlobal } from 'astro'
import type { Project } from '../source/projects'
import type { Store } from '../source/store'
import { stripCodes } from '../doc/plain'

export interface PageCtx {
  project: Project
  store: Store
  plain: boolean
  /** Rewrites text for the plain audience (drops codes); identity for engineers. */
  say: (s: string) => string
}

export async function pageCtx(Astro: AstroGlobal): Promise<PageCtx | null> {
  const hub = Astro.locals.hub
  const project = hub.project(Astro.params.project ?? '')
  const store = project ? await hub.store(project.id) : null
  if (!project || !store) return null
  const plain = project.audience === 'plain'
  return { project, store, plain, say: (s) => (plain ? stripCodes(s).trim() || s : s) }
}

export function notFound(what: string): Response {
  return new Response(`Not found: ${what}`, { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
