import { Hono } from 'hono'
import { cachedSource } from '../server/cache.js'
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
}

function isProjectConfig(value: unknown): value is ProjectConfig {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.repo === 'string' &&
    typeof value.branch === 'string' &&
    typeof value.folder === 'string'
  )
}

// PROJECTS unset keeps today's single-repo behaviour identical: one project built
// from the legacy GITHUB_OWNER/GITHUB_REPO/GITHUB_PATH_PREFIX vars.
function parseProjectConfigs(env: Env): ProjectConfig[] {
  const raw = env.PROJECTS?.trim()
  if (raw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    if (Array.isArray(parsed)) {
      const configs = parsed.filter(isProjectConfig)
      if (configs.length > 0) return configs
    }
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

function buildApi(env: Env): { projects: ProjectInfo[]; sourceFor: (id: string) => ContextSource | null } {
  const configs = parseProjectConfigs(env)
  const projects: ProjectInfo[] = configs.map((cfg) => ({ id: cfg.id, name: cfg.name, sourceKind: 'github' }))

  const byId = new Map<string, ContextSource>()
  for (const cfg of configs) {
    let source: ContextSource = githubSource({
      token: env.GITHUB_TOKEN || '',
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
  const { projects, sourceFor } = buildApi(c.env)
  return createApi({ projects, sourceFor }).fetch(c.req.raw, c.env)
})

export const onRequest = (ctx: PagesContext): Response | Promise<Response> => {
  return app.fetch(ctx.request, ctx.env)
}
