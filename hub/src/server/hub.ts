import { env } from 'cloudflare:workers'
import type { Meter } from '../source/github'
import type { Project } from '../source/projects'
import { loadProjects, tokenFor } from '../source/projects'
import type { KVLike, Store } from '../source/store'
import { createStore } from '../source/store'

export interface HubEnv {
  GITHUB_TOKEN?: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  GITHUB_PATH_PREFIX?: string
  PROJECTS?: string
  ACCESS_TEAM_DOMAIN?: string
  ACCESS_AUD?: string
  CTX_CACHE?: KVLike
  CTX_CONFIG?: KVLike
}

export const hubEnv = env as unknown as HubEnv

export interface Hub {
  projects: Project[]
  project(id: string): Project | null
  store(id: string): Promise<Store | null>
  meter: Meter
}

/** One per request: holds the GitHub call count and memoises each project's store. */
export async function createHub(meter: Meter): Promise<Hub> {
  const projects = await loadProjects(hubEnv, hubEnv.CTX_CONFIG ?? null)
  const stores = new Map<string, Promise<Store>>()
  const project = (id: string) => projects.find((p) => p.id === id) ?? null
  return {
    projects,
    project,
    meter,
    async store(id) {
      const p = project(id)
      if (!p) return null
      let s = stores.get(id)
      if (!s) {
        s = tokenFor(p.owner, hubEnv, hubEnv.CTX_CONFIG ?? null).then((token) =>
          createStore({ token, owner: p.owner, repo: p.repo, branch: p.branch, folder: p.folder }, hubEnv.CTX_CACHE ?? null, p.id, meter),
        )
        stores.set(id, s)
      }
      return s
    },
  }
}
