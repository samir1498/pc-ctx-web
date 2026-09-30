import { isRecord } from './folders'
import type { KVLike } from './store'

export type Audience = 'plain' | 'engineering'

export interface Project {
  id: string
  name: string
  owner: string
  repo: string
  branch: string
  folder: string
  audience: Audience
}

export interface ProjectEnv {
  GITHUB_TOKEN?: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  GITHUB_PATH_PREFIX?: string
  PROJECTS?: string
}

function isProject(v: unknown): v is Omit<Project, 'audience'> & { audience?: Audience; source?: string } {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.owner === 'string' &&
    typeof v.repo === 'string' &&
    typeof v.branch === 'string' &&
    typeof v.folder === 'string' &&
    (v.source === undefined || v.source === 'github')
  )
}

const withAudience = (p: Omit<Project, 'audience'> & { audience?: Audience }): Project => ({
  id: p.id,
  name: p.name,
  owner: p.owner,
  repo: p.repo,
  branch: p.branch,
  folder: p.folder,
  audience: p.audience === 'plain' ? 'plain' : 'engineering',
})

/** Projects saved by the old settings page win; then PROJECTS; then the single-repo vars. */
export async function loadProjects(env: ProjectEnv, config: KVLike | null): Promise<Project[]> {
  const stored = config ? await config.get('config:projects', 'json') : null
  if (Array.isArray(stored)) {
    const list = stored.filter(isProject)
    if (list.length) return list.map(withAudience)
  }
  const raw = env.PROJECTS?.trim()
  if (raw) {
    // A set-but-broken PROJECTS must not fall back to a default repo and serve the wrong store.
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length || !parsed.every(isProject)) throw new Error('PROJECTS must be a non-empty array of {id,name,owner,repo,branch,folder}')
    return parsed.map(withAudience)
  }
  const repo = env.GITHUB_REPO || 'personal-context'
  return [{ id: 'default', name: repo, owner: env.GITHUB_OWNER || 'samir1498', repo, branch: 'main', folder: env.GITHUB_PATH_PREFIX || '', audience: 'engineering' }]
}

/** The per-owner token the settings page saved, else the deployment's GITHUB_TOKEN. */
export async function tokenFor(owner: string, env: ProjectEnv, config: KVLike | null): Promise<string> {
  const saved = config ? await config.get(`token:${owner}`, 'json') : null
  if (typeof saved === 'string' && saved) return saved
  if (isRecord(saved) && typeof saved.token === 'string') return saved.token
  return env.GITHUB_TOKEN ?? ''
}
