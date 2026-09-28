import { Hono } from 'hono'
import { cachedSource } from '../server/cache.js'
import { createConfigApi } from '../server/config-api.js'
import type { ConfigStore } from '../server/config-store.js'
import { isGithubProjectConfig, kvConfigStore } from '../server/config-store.js'
import type { ContextSource } from '../server/source.js'
import { isRecord } from '../server/source.js'
import type { ProjectInfo } from '../server/api.js'
import { createApi } from '../server/api.js'
import { githubSource } from '../server/github.js'

type Env = {
  GITHUB_TOKEN?: string
  GITHUB_OWNER?: string
  GITHUB_REPO?: string
  GITHUB_PATH_PREFIX?: string
  PROJECTS?: string
  AUTH_GATE?: string
  CTX_CACHE?: KVNamespace
  CTX_CONFIG?: KVNamespace
  ASSETS: { fetch: (req: Request) => Response | Promise<Response> }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isAuthorized(req: Request, env: Env): boolean {
  const gate = env.AUTH_GATE?.trim()
  if (!gate) return true
  const header = req.headers.get('Authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return false
  let decoded: string
  try {
    decoded = atob(encoded)
  } catch {
    return false
  }
  return gate
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .some((pair) => timingSafeEqual(pair, decoded))
}

interface PagesContext {
  request: Request
  env: Env
  params: Record<string, string>
  next: () => Promise<Response>
}

const DEFAULT_OWNER = 'samir1498'
const DEFAULT_REPO = 'personal-context'
const DEFAULT_BRANCH = 'main'

interface ProjectConfig {
  id: string
  name: string
  owner: string
  repo: string
  branch: string
  folder: string
  audience?: 'plain' | 'engineering'
}

function isProjectConfig(value: unknown): value is ProjectConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.repo === 'string' &&
    typeof value.branch === 'string' &&
    typeof value.folder === 'string' &&
    (value.audience === undefined || value.audience === 'plain' || value.audience === 'engineering')
  )
}

// PROJECTS unset keeps today's single-repo behaviour identical: one project built
// from the legacy GITHUB_OWNER/GITHUB_REPO/GITHUB_PATH_PREFIX vars.
function parseProjectConfigs(env: Env): ProjectConfig[] {
  const raw = env.PROJECTS?.trim()
  if (raw) {
    // A set-but-broken PROJECTS must not fall back to the default repo and serve the wrong content.
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      throw new Error('PROJECTS is not valid JSON')
    }
    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isProjectConfig)) {
      throw new Error('PROJECTS must be a non-empty array of {id,name,owner,repo,branch,folder}')
    }
    return parsed
  }
  return [
    {
      id: 'default',
      name: env.GITHUB_REPO || DEFAULT_REPO,
      owner: env.GITHUB_OWNER || DEFAULT_OWNER,
      repo: env.GITHUB_REPO || DEFAULT_REPO,
      branch: DEFAULT_BRANCH,
      folder: env.GITHUB_PATH_PREFIX || '',
    },
  ]
}

// KV never holds a disk project (kvConfigStore.saveProjects refuses them), so any stored
// project resolves to this file's github-shaped ProjectConfig once the discriminant is dropped.
async function resolveProjectConfigs(env: Env, store: ConfigStore | null): Promise<ProjectConfig[]> {
  if (store) {
    const stored = (await store.getProjects()).filter(isGithubProjectConfig)
    if (stored.length > 0) {
      return stored.map((p) => ({
        id: p.id,
        name: p.name,
        owner: p.owner,
        repo: p.repo,
        branch: p.branch,
        folder: p.folder,
        audience: p.audience,
      }))
    }
  }
  return parseProjectConfigs(env)
}

async function buildApi(env: Env, store: ConfigStore | null): Promise<{ projects: ProjectInfo[]; sourceFor: (id: string) => ContextSource | null }> {
  const configs = await resolveProjectConfigs(env, store)
  const projects: ProjectInfo[] = configs.map((cfg) => ({ id: cfg.id, name: cfg.name, sourceKind: 'github', audience: cfg.audience ?? 'engineering' }))

  const byId = new Map<string, ContextSource>()
  for (const cfg of configs) {
    const token = (store ? await store.getToken(cfg.owner) : null) || env.GITHUB_TOKEN || ''
    let source: ContextSource = githubSource({
      token,
      owner: cfg.owner,
      repo: cfg.repo,
      branch: cfg.branch,
      folder: cfg.folder,
    })
    if (env.CTX_CACHE) {
      source = cachedSource(source, env.CTX_CACHE, { projectId: cfg.id })
    }
    byId.set(cfg.id, source)
  }

  return { projects, sourceFor: (id) => byId.get(id) ?? null }
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  if (!isAuthorized(c.req.raw, c.env)) {
    return c.body('Authentication required', 401, {
      'WWW-Authenticate': 'Basic realm="pc-ctx", charset="UTF-8"',
    })
  }
  await next()
})

app.all('*', async (c) => {
  const { pathname } = new URL(c.req.raw.url)
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    return c.env.ASSETS.fetch(c.req.raw)
  }

  const store = c.env.CTX_CONFIG ? kvConfigStore(c.env.CTX_CONFIG) : null
  if (pathname === '/api/config' || pathname.startsWith('/api/config/')) {
    if (!store) return c.json({ error: 'settings storage not configured' }, 503)
    return createConfigApi({ store, mode: 'deployed', github: fetch }).fetch(c.req.raw, c.env)
  }

  // Pictures are bytes, not KV material: the edge cache in front of the
  // function holds them for the hour the response header says.
  const isMedia = /^\/api\/p\/[^/]+\/media\//.test(pathname) && c.req.method === 'GET'
  const edge = isMedia && typeof caches !== 'undefined' ? caches.default : null
  if (edge) {
    const hit = await edge.match(c.req.raw)
    if (hit) return hit
  }

  const { projects, sourceFor } = await buildApi(c.env, store)
  const res = await createApi({ projects, sourceFor }).fetch(c.req.raw, c.env)
  if (edge && res.ok) c.executionCtx.waitUntil(edge.put(c.req.raw, res.clone()))
  return res
})

export const onRequest = (ctx: PagesContext): Response | Promise<Response> => {
  return app.fetch(ctx.request, ctx.env)
}
